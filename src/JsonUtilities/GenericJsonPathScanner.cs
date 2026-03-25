using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using JsonUtilities.Models;
using Microsoft.Extensions.Logging;

namespace JsonUtilities;

/// <summary>
/// High-performance dot-notation JSON path scanner.
/// Navigates nested JSON structures using streaming reads with minimal allocations,
/// extracting all objects found at a specified path (e.g. <c>company.departments.engineering.employees</c>).
/// </summary>
/// <remarks>
/// The scanner buffers the entire stream into a pooled <see cref="ArrayPool{T}"/> buffer,
/// then uses a <see cref="System.IO.StreamReader"/> for character-level path navigation.
/// Object bytes are read directly from the underlying <see cref="System.IO.MemoryStream"/> using
/// precise byte offsets, avoiding redundant string allocations.
/// </remarks>
public class GenericJsonPathScanner : IJsonPathScanner
{
    private readonly IJsonValidator _validator;
    private readonly ILogger<GenericJsonPathScanner>? _logger;

    /// <summary>
    /// Initializes a new <see cref="GenericJsonPathScanner"/> with optional validator and logger.
    /// </summary>
    /// <param name="validator">Custom validator implementation. Defaults to <see cref="JsonValidator"/> when <c>null</c>.</param>
    /// <param name="logger">Optional logger for progress and warning messages.</param>
    public GenericJsonPathScanner(IJsonValidator? validator = null, ILogger<GenericJsonPathScanner>? logger = null)
    {
        _validator = validator ?? new JsonValidator();
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<JsonPathScanResult> ScanAsync(string filePath, string jsonPath, JsonPathScanOptions options)
    {
        if (!File.Exists(filePath))
            return new JsonPathScanResult
            {
                JsonPath = jsonPath,
                ValidationErrors = [$"File not found: {filePath}"]
            };

        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read,
            FileShare.Read, 65536, useAsync: true);
        return await ScanAsync(stream, jsonPath, options);
    }

    /// <inheritdoc/>
    public async Task<JsonPathScanResult> ScanAsync(Stream stream, string jsonPath, JsonPathScanOptions options)
    {
        var metadata = new ScanMetadata { StartTime = DateTime.UtcNow };
        var result = new JsonPathScanResult { JsonPath = jsonPath, Metadata = metadata };
        var errors = new List<string>();
        var foundObjects = new List<JsonObjectRange>();

        try
        {
            if (string.IsNullOrWhiteSpace(jsonPath))
            {
                errors.Add("JSON path cannot be empty");
                result.ValidationErrors = errors.ToArray();
                return result;
            }

            metadata.BytesProcessed = stream.Length;

            await ProcessStreamAsync(stream, jsonPath, obj => foundObjects.Add(obj), options);
            result.Objects = foundObjects.ToArray();
            metadata.TotalObjectsFound = foundObjects.Count;
            _logger?.LogInformation("Path scan complete: {Count} objects at '{Path}'", foundObjects.Count, jsonPath);
        }
        catch (Exception ex)
        {
            errors.Add($"Path scan failed: {ex.Message}");
            _logger?.LogError(ex, "Error during JSON path scanning");
        }
        finally
        {
            metadata.EndTime = DateTime.UtcNow;
            metadata.ErrorCount = errors.Count;
            result.ValidationErrors = errors.ToArray();
        }

        return result;
    }

    /// <inheritdoc/>
    public async Task ProcessStreamAsync(Stream stream, string jsonPath, Action<JsonObjectRange> processor, JsonPathScanOptions options)
    {
        if (string.IsNullOrWhiteSpace(jsonPath))
            throw new ArgumentException("JSON path cannot be empty.", nameof(jsonPath));

        string[] targetSegments = jsonPath.Split('.');
        if (!options.StrictMode)
            for (int i = 0; i < targetSegments.Length; i++)
                targetSegments[i] = targetSegments[i].ToLowerInvariant();

        int length = (int)stream.Length;
        byte[] rentedBuf = ArrayPool<byte>.Shared.Rent(length);
        try
        {
            int read = 0;
            while (read < length)
                read += await stream.ReadAsync(rentedBuf.AsMemory(read, length - read));

            if (options.ValidateUtf8)
            {
                try { _validator.ValidateUtf8Safety(Encoding.UTF8.GetString(rentedBuf, 0, length)); }
                catch (Exception ex)
                {
                    if (!options.ContinueOnError)
                        throw new InvalidOperationException($"UTF-8 validation failed: {ex.Message}", ex);
                }
            }

            using var ms = new MemoryStream(rentedBuf, 0, length, writable: false);
            using var reader = new StreamReader(ms, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, -1, leaveOpen: true);

            long byteOffset = 0;
            var (found, offset) = FindJsonPath(reader, targetSegments, ref byteOffset, options);
            if (!found)
            {
                _logger?.LogWarning("Target JSON path '{Path}' not found.", jsonPath);
                return;
            }

            byteOffset = offset;
            await ExtractJsonObjectsAsync(reader, ms, processor, byteOffset, options);
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(rentedBuf);
        }
    }

    private static (bool found, long byteOffset) FindJsonPath(
        StreamReader reader, string[] targetSegments, ref long byteOffset, JsonPathScanOptions options)
    {
        int depth = 0;
        bool inQuote = false;
        var sb = new StringBuilder(64);

        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;

            if (c == '"')
            {
                inQuote = !inQuote;
                if (inQuote) continue;

                string token = options.StrictMode ? sb.ToString() : sb.ToString().ToLowerInvariant();
                if (token == targetSegments[depth])
                {
                    depth++;
                    if (depth == targetSegments.Length)
                    {
                        var (found, off) = SeekToArray(reader, byteOffset);
                        return (found, off);
                    }
                }
                sb.Clear();
            }
            else if (inQuote)
            {
                sb.Append(c);
            }
        }

        return (false, byteOffset);
    }

    private static (bool found, long byteOffset) SeekToArray(StreamReader reader, long byteOffset)
    {
        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '[') return (true, byteOffset);
            if (c == '{') byteOffset = SkipObject(reader, byteOffset);
        }
        return (false, byteOffset);
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static long SkipObject(StreamReader reader, long byteOffset)
    {
        int depth = 1;
        while (!reader.EndOfStream && depth > 0)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '{') depth++;
            else if (c == '}') depth--;
        }
        return byteOffset;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static long SkipArray(StreamReader reader, long byteOffset)
    {
        int depth = 1;
        while (!reader.EndOfStream && depth > 0)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '[') depth++;
            else if (c == ']') depth--;
        }
        return byteOffset;
    }

    private async Task ExtractJsonObjectsAsync(
        StreamReader reader, Stream baseStream, Action<JsonObjectRange> processor,
        long byteOffset, JsonPathScanOptions options)
    {
        long startPos = 0;
        int depth = 0;
        bool inObject = false;
        int objectIndex = 0;

        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;

            if (char.IsWhiteSpace(c)) continue;
            if (!inObject && c == ']') break;

            if (!inObject && c == '{')
            {
                startPos = byteOffset - 1;
                depth = 1;
                inObject = true;
                continue;
            }

            if (!inObject) continue;

            if (c == '{') depth++;
            else if (c == '}') depth--;

            if (depth != 0) continue;

            long objLen = byteOffset - startPos;
            if (objLen > options.MaxObjectSize)
            {
                if (!options.ContinueOnError)
                    throw new InvalidOperationException($"Object size ({objLen}) exceeds maximum ({options.MaxObjectSize})");
                inObject = false;
                depth = 0;
                continue;
            }

            byte[] buf = ArrayPool<byte>.Shared.Rent((int)objLen);
            try
            {
                long savedPos = baseStream.Position;
                baseStream.Seek(startPos, SeekOrigin.Begin);
                await baseStream.ReadAsync(buf.AsMemory(0, (int)objLen));
                baseStream.Position = savedPos;

                string text = Encoding.UTF8.GetString(buf, 0, (int)objLen);

                if (!options.SkipStructureValidation && !_validator.IsValidJsonStructure(text) && !options.ContinueOnError)
                    throw new InvalidOperationException($"Invalid JSON at position {startPos}");

                var range = new JsonObjectRange
                {
                    StartPosition = startPos,
                    Length = objLen,
                    ItemIndex = objectIndex++
                };

                if (options.IncludeJsonContent) range.JsonContent = text;
                if (options.CalculateHashes) range.Hash = ComputeMd5Hex(buf.AsSpan(0, (int)objLen));

                processor(range);
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buf);
            }

            inObject = false;
            depth = 0;

            while (!reader.EndOfStream)
            {
                c = (char)reader.Read();
                byteOffset++;
                if (char.IsWhiteSpace(c) || c == ',') continue;
                if (c == ']') return;
                if (c == '{')
                {
                    startPos = byteOffset - 1;
                    depth = 1;
                    inObject = true;
                    break;
                }
            }
        }
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ComputeMd5Hex(ReadOnlySpan<byte> data)
    {
        Span<byte> hash = stackalloc byte[16];
        MD5.HashData(data, hash);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
