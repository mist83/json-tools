using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using JsonUtilities.Models;
using Microsoft.Extensions.Logging;

namespace JsonUtilities;

/// <summary>
/// High-performance dot-notation JSON path scanner.
/// Navigates nested JSON structures incrementally, extracting all objects found at a specified
/// path (for example <c>company.departments.engineering.employees</c>) without preloading the full stream.
/// </summary>
/// <remarks>
/// The scanner parses the source in fixed-size UTF-8 chunks, tracks the active property path,
/// and buffers only the currently matched object when content, hashing, or validation are requested.
/// This keeps memory bounded for large inputs and non-seekable streams.
/// </remarks>
public class GenericJsonPathScanner : IJsonPathScanner
{
    private readonly IJsonValidator _validator;
    private readonly ILogger<GenericJsonPathScanner>? _logger;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

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
            FileShare.Read, Math.Max(256, options.BufferSize), useAsync: true);
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

            await ProcessStreamInternalAsync(stream, jsonPath, obj => foundObjects.Add(obj), options, metadata);
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
    public Task ProcessStreamAsync(Stream stream, string jsonPath, Action<JsonObjectRange> processor, JsonPathScanOptions options)
    {
        return ProcessStreamInternalAsync(stream, jsonPath, processor, options, metadata: null);
    }

    private async Task ProcessStreamInternalAsync(
        Stream stream,
        string jsonPath,
        Action<JsonObjectRange> processor,
        JsonPathScanOptions options,
        ScanMetadata? metadata)
    {
        ArgumentNullException.ThrowIfNull(stream);
        ArgumentNullException.ThrowIfNull(processor);
        ArgumentNullException.ThrowIfNull(options);

        if (!stream.CanRead)
            throw new InvalidOperationException("Stream must be readable.");

        if (string.IsNullOrWhiteSpace(jsonPath))
            throw new ArgumentException("JSON path cannot be empty.", nameof(jsonPath));

        string[] targetSegments = NormalizePathSegments(jsonPath, options.StrictMode);
        bool shouldBufferObject = ShouldBufferObject(options);
        int initialBufferSize = Math.Max(256, options.BufferSize);
        byte[] buffer = ArrayPool<byte>.Shared.Rent(initialBufferSize);
        var readerState = new JsonReaderState();
        var utf8Validator = options.ValidateUtf8 ? new StreamingUtf8Validator() : null;
        int bufferedCount = 0;
        long bufferStartOffset = 0;
        var scannerState = new PathScannerState(targetSegments.Length);

        try
        {
            while (!scannerState.Finished)
            {
                if (bufferedCount == buffer.Length)
                    buffer = GrowBuffer(buffer, bufferedCount, options.MaxObjectSize);

                int bytesRead = await stream.ReadAsync(buffer.AsMemory(bufferedCount, buffer.Length - bufferedCount));
                if (metadata != null) metadata.BytesProcessed += bytesRead;

                if (bytesRead > 0)
                    utf8Validator?.Validate(buffer.AsSpan(bufferedCount, bytesRead), flush: false);

                bufferedCount += bytesRead;
                bool isFinalBlock = bytesRead == 0;

                if (!scannerState.BomProcessed)
                {
                    if (bufferedCount < 3 && !isFinalBlock)
                        continue;

                    scannerState.BomProcessed = true;
                    if (HasUtf8Bom(buffer, bufferedCount))
                    {
                        if (bufferedCount > 3)
                            Buffer.BlockCopy(buffer, 3, buffer, 0, bufferedCount - 3);
                        bufferedCount -= 3;
                        bufferStartOffset += 3;
                    }
                }

                if (bufferedCount == 0 && isFinalBlock)
                {
                    utf8Validator?.Validate(ReadOnlySpan<byte>.Empty, flush: true);
                    break;
                }

                int consumed = ProcessBufferedData(
                    buffer.AsSpan(0, bufferedCount),
                    isFinalBlock,
                    bufferStartOffset,
                    processor,
                    options,
                    targetSegments,
                    shouldBufferObject,
                    ref readerState,
                    scannerState);
                int remaining = bufferedCount - consumed;

                if (!isFinalBlock && consumed == 0 && remaining == buffer.Length)
                    buffer = GrowBuffer(buffer, remaining, options.MaxObjectSize);

                if (remaining > 0 && consumed > 0)
                    Buffer.BlockCopy(buffer, consumed, buffer, 0, remaining);

                bufferedCount = remaining;
                bufferStartOffset += consumed;

                if (isFinalBlock)
                {
                    utf8Validator?.Validate(ReadOnlySpan<byte>.Empty, flush: true);
                    break;
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private int ProcessBufferedData(
        ReadOnlySpan<byte> data,
        bool isFinalBlock,
        long bufferStartOffset,
        Action<JsonObjectRange> processor,
        JsonPathScanOptions options,
        string[] targetSegments,
        bool shouldBufferObject,
        ref JsonReaderState readerState,
        PathScannerState scannerState)
    {
        var reader = new Utf8JsonReader(data, isFinalBlock, readerState);

        while (reader.Read())
        {
            long tokenStartAbsolute = bufferStartOffset + reader.TokenStartIndex;
            long tokenEndAbsolute = bufferStartOffset + reader.BytesConsumed;

            switch (reader.TokenType)
            {
                case JsonTokenType.PropertyName:
                    scannerState.PendingPropertyName = NormalizeSegment(reader.GetString() ?? string.Empty, options.StrictMode);
                    break;

                case JsonTokenType.StartObject:
                {
                    bool parentIsTargetArray = scannerState.ContainerStack.Count > 0 && scannerState.ContainerStack[^1].IsTargetArray;
                    string? pendingPropertyName = scannerState.PendingPropertyName;
                    bool pushedPath = PushPendingPathSegment(scannerState.CurrentPath, ref pendingPropertyName);
                    scannerState.PendingPropertyName = pendingPropertyName;
                    scannerState.ContainerStack.Add(new ContainerFrame(JsonTokenType.StartObject, pushedPath, false));

                    if (scannerState.Capture != null)
                    {
                        scannerState.Capture.Depth++;
                    }
                    else if (parentIsTargetArray)
                    {
                        scannerState.Capture = new ObjectCapture(tokenStartAbsolute, shouldBufferObject);
                    }

                    break;
                }

                case JsonTokenType.EndObject:
                    if (scannerState.Capture != null)
                        scannerState.Capture.Depth--;

                    PopContainerFrame(scannerState.ContainerStack, scannerState.CurrentPath);
                    scannerState.PendingPropertyName = null;
                    break;

                case JsonTokenType.StartArray:
                {
                    string? pendingPropertyName = scannerState.PendingPropertyName;
                    bool pushedPath = PushPendingPathSegment(scannerState.CurrentPath, ref pendingPropertyName);
                    scannerState.PendingPropertyName = pendingPropertyName;
                    bool isTargetArray = !scannerState.TargetArrayFound && PathEquals(scannerState.CurrentPath, targetSegments);
                    scannerState.ContainerStack.Add(new ContainerFrame(JsonTokenType.StartArray, pushedPath, isTargetArray));
                    if (isTargetArray)
                    {
                        scannerState.TargetArrayFound = true;
                        scannerState.ObjectIndex = 0;
                    }
                    break;
                }

                case JsonTokenType.EndArray:
                {
                    var frame = PopContainerFrame(scannerState.ContainerStack, scannerState.CurrentPath);
                    scannerState.PendingPropertyName = null;
                    if (frame.IsTargetArray)
                        scannerState.Finished = true;
                    break;
                }

                default:
                    scannerState.PendingPropertyName = null;
                    break;
            }

            if (scannerState.Capture != null)
            {
                scannerState.Capture.Length = tokenEndAbsolute - scannerState.Capture.StartPosition;
                if (scannerState.Capture.ShouldBuffer && scannerState.Capture.NextCopyAbsoluteOffset < tokenEndAbsolute)
                {
                    int copyStart = checked((int)(scannerState.Capture.NextCopyAbsoluteOffset - bufferStartOffset));
                    int copyLength = checked((int)(tokenEndAbsolute - scannerState.Capture.NextCopyAbsoluteOffset));
                    scannerState.Capture.Buffer!.Write(data.Slice(copyStart, copyLength));
                    scannerState.Capture.NextCopyAbsoluteOffset = tokenEndAbsolute;
                }

                if (scannerState.Capture.Depth == 0)
                {
                    if (scannerState.Capture.Length > options.MaxObjectSize)
                    {
                        if (!options.ContinueOnError)
                            throw new InvalidOperationException($"Object size ({scannerState.Capture.Length}) exceeds maximum ({options.MaxObjectSize})");
                    }
                    else
                    {
                        var range = BuildRange(scannerState.Capture, scannerState.ObjectIndex, options);
                        processor(range);
                        scannerState.ObjectIndex++;
                    }

                    scannerState.Capture = null;
                }
            }

            if (scannerState.Finished) break;
        }

        long consumedAbsolute = bufferStartOffset + reader.BytesConsumed;
        if (scannerState.Capture != null && scannerState.Capture.ShouldBuffer && scannerState.Capture.NextCopyAbsoluteOffset < consumedAbsolute)
        {
            int copyStart = checked((int)(scannerState.Capture.NextCopyAbsoluteOffset - bufferStartOffset));
            int copyLength = checked((int)(consumedAbsolute - scannerState.Capture.NextCopyAbsoluteOffset));
            scannerState.Capture.Buffer!.Write(data.Slice(copyStart, copyLength));
            scannerState.Capture.NextCopyAbsoluteOffset = consumedAbsolute;
        }

        readerState = reader.CurrentState;
        return (int)reader.BytesConsumed;
    }

    private JsonObjectRange BuildRange(ObjectCapture capture, int itemIndex, JsonPathScanOptions options)
    {
        string? text = null;
        if (capture.Buffer != null && (options.IncludeJsonContent || !options.SkipStructureValidation))
            text = Encoding.UTF8.GetString(capture.Buffer.WrittenSpan);

        if (!options.SkipStructureValidation && text != null && !_validator.IsValidJsonStructure(text))
            throw new InvalidOperationException($"Invalid JSON at position {capture.StartPosition}");

        var range = new JsonObjectRange
        {
            StartPosition = capture.StartPosition,
            Length = capture.Length,
            ItemIndex = itemIndex
        };

        if (options.IncludeJsonContent)
            range.JsonContent = text;

        if (options.CalculateHashes && capture.Buffer != null)
            range.Hash = ComputeMd5Hex(capture.Buffer.WrittenSpan);

        return range;
    }

    private static string[] NormalizePathSegments(string jsonPath, bool strictMode)
    {
        string[] segments = jsonPath.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!strictMode)
        {
            for (int i = 0; i < segments.Length; i++)
                segments[i] = segments[i].ToLowerInvariant();
        }

        return segments;
    }

    private static string NormalizeSegment(string segment, bool strictMode) =>
        strictMode ? segment : segment.ToLowerInvariant();

    private static bool PathEquals(List<string> currentPath, string[] targetSegments)
    {
        if (currentPath.Count != targetSegments.Length) return false;

        for (int i = 0; i < currentPath.Count; i++)
        {
            if (!string.Equals(currentPath[i], targetSegments[i], StringComparison.Ordinal))
                return false;
        }

        return true;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static bool HasUtf8Bom(byte[] buffer, int length)
    {
        return length >= 3
            && buffer[0] == 0xEF
            && buffer[1] == 0xBB
            && buffer[2] == 0xBF;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static bool PushPendingPathSegment(List<string> currentPath, ref string? pendingPropertyName)
    {
        if (pendingPropertyName == null) return false;

        currentPath.Add(pendingPropertyName);
        pendingPropertyName = null;
        return true;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static ContainerFrame PopContainerFrame(List<ContainerFrame> containerStack, List<string> currentPath)
    {
        var frame = containerStack[^1];
        containerStack.RemoveAt(containerStack.Count - 1);
        if (frame.PushedPathSegment)
            currentPath.RemoveAt(currentPath.Count - 1);
        return frame;
    }

    private static bool ShouldBufferObject(JsonPathScanOptions options)
    {
        return options.IncludeJsonContent
            || options.CalculateHashes
            || !options.SkipStructureValidation;
    }

    private static byte[] GrowBuffer(byte[] currentBuffer, int usedLength, long maxObjectSize)
    {
        long maxBufferSize = Math.Min(maxObjectSize, int.MaxValue);
        if (currentBuffer.Length >= maxBufferSize)
            throw new InvalidOperationException("Unable to continue path scanning because a single token exceeds the configured maximum object size.");

        int nextSize = currentBuffer.Length >= int.MaxValue / 2 ? int.MaxValue : currentBuffer.Length * 2;
        if (nextSize > maxBufferSize)
            nextSize = (int)maxBufferSize;

        byte[] nextBuffer = ArrayPool<byte>.Shared.Rent(nextSize);
        Buffer.BlockCopy(currentBuffer, 0, nextBuffer, 0, usedLength);
        ArrayPool<byte>.Shared.Return(currentBuffer);
        return nextBuffer;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ComputeMd5Hex(ReadOnlySpan<byte> data)
    {
        Span<byte> hash = stackalloc byte[16];
        MD5.HashData(data, hash);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private readonly record struct ContainerFrame(JsonTokenType Type, bool PushedPathSegment, bool IsTargetArray);

    private sealed class ObjectCapture
    {
        public ObjectCapture(long startPosition, bool shouldBuffer)
        {
            StartPosition = startPosition;
            Depth = 1;
            if (shouldBuffer)
                Buffer = new ArrayBufferWriter<byte>();
            NextCopyAbsoluteOffset = startPosition;
        }

        public long StartPosition { get; }

        public ArrayBufferWriter<byte>? Buffer { get; }

        public bool ShouldBuffer => Buffer != null;

        public long NextCopyAbsoluteOffset { get; set; }

        public int Depth { get; set; }

        public long Length { get; set; }
    }

    private sealed class PathScannerState
    {
        public PathScannerState(int targetSegmentCount)
        {
            CurrentPath = new List<string>(targetSegmentCount);
            ContainerStack = new List<ContainerFrame>(16);
        }

        public List<string> CurrentPath { get; }

        public List<ContainerFrame> ContainerStack { get; }

        public string? PendingPropertyName { get; set; }

        public bool TargetArrayFound { get; set; }

        public int ObjectIndex { get; set; }

        public ObjectCapture? Capture { get; set; }

        public bool Finished { get; set; }

        public bool BomProcessed { get; set; }
    }

    private sealed class StreamingUtf8Validator
    {
        private readonly Decoder _decoder = StrictUtf8.GetDecoder();
        private readonly char[] _chars = new char[1024];

        public void Validate(ReadOnlySpan<byte> bytes, bool flush)
        {
            while (!bytes.IsEmpty || flush)
            {
                _decoder.Convert(bytes, _chars, flush, out int bytesUsed, out _, out bool completed);
                bytes = bytes[bytesUsed..];
                if (completed) break;
            }
        }
    }
}
