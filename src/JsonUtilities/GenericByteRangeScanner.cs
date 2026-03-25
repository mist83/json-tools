using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using JsonUtilities.Models;
using Microsoft.Extensions.Logging;

namespace JsonUtilities;

/// <summary>
/// High-performance byte-range scanner for JSON collections.
/// Uses Span&lt;T&gt; and ArrayPool to minimize allocations.
/// Scans raw bytes without full deserialization for maximum throughput.
/// </summary>
public class GenericByteRangeScanner : IJsonScanner
{
    private readonly IJsonValidator _validator;
    private readonly ILogger<GenericByteRangeScanner>? _logger;

    // ASCII byte constants — avoid magic numbers
    private const byte ByteBackslash = (byte)'\\';
    private const byte ByteQuote = (byte)'"';
    private const byte ByteOpenBrace = (byte)'{';
    private const byte ByteCloseBrace = (byte)'}';
    private const byte ByteOpenBracket = (byte)'[';
    private const byte ByteCloseBracket = (byte)']';

    public GenericByteRangeScanner(IJsonValidator? validator = null, ILogger<GenericByteRangeScanner>? logger = null)
    {
        _validator = validator ?? new JsonValidator();
        _logger = logger;
    }

    public async Task<JsonScanResult> ScanAsync(string filePath, JsonScanOptions options)
    {
        if (!File.Exists(filePath))
            return new JsonScanResult { ValidationErrors = [$"File not found: {filePath}"] };

        // Use FileStream with optimal buffer size and async flag
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read,
            FileShare.Read, options.BufferSize, useAsync: true);
        var result = await ScanAsync(stream, options);
        result.Metadata.FilesProcessed = 1;
        return result;
    }

    public async Task<JsonScanResult> ScanAsync(Stream stream, JsonScanOptions options)
    {
        var metadata = new ScanMetadata { StartTime = DateTime.UtcNow };
        var result = new JsonScanResult { Metadata = metadata };
        var errors = new List<string>();

        try
        {
            // Read entire stream into a pooled buffer
            int length = (int)stream.Length;
            byte[] rentedBuffer = ArrayPool<byte>.Shared.Rent(length);
            try
            {
                int bytesRead = 0;
                while (bytesRead < length)
                    bytesRead += await stream.ReadAsync(rentedBuffer.AsMemory(bytesRead, length - bytesRead));

                metadata.BytesProcessed = length;

                if (options.ValidateUtf8)
                {
                    try { _validator.ValidateUtf8Safety(Encoding.UTF8.GetString(rentedBuffer, 0, length)); }
                    catch (Exception ex)
                    {
                        errors.Add($"UTF-8 validation failed: {ex.Message}");
                        if (!options.ContinueOnError)
                        {
                            result.ValidationErrors = errors.ToArray();
                            return result;
                        }
                    }
                }

                // Pass the actual byte array slice (not span) to async method
                byte[] byteArray = rentedBuffer[..length];
                var collections = await ScanForCollections(byteArray, options, errors);
                result.Collections = collections;
                metadata.TotalObjectsFound = collections.Values.Sum(x => x.Length);
                metadata.CollectionsScanned = collections.Count;
                Log($"Scan complete: {metadata.TotalObjectsFound} objects in {metadata.CollectionsScanned} collections.");
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(rentedBuffer);
            }
        }
        catch (Exception ex)
        {
            errors.Add($"Scan failed: {ex.Message}");
            _logger?.LogError(ex, "Error during JSON scanning");
        }
        finally
        {
            metadata.EndTime = DateTime.UtcNow;
            metadata.ErrorCount = errors.Count;
            result.ValidationErrors = errors.ToArray();
        }

        return result;
    }

    private async Task<Dictionary<string, JsonObjectRange[]>> ScanForCollections(
        byte[] bytes, JsonScanOptions options, List<string> errors)
    {
        var collectionItems = new Dictionary<string, List<JsonObjectRange>>(StringComparer.OrdinalIgnoreCase);
        string[] collections = options.TargetCollections ?? await DetectCollections(bytes);

        // Pre-compute lowercase search keys for fast matching
        var searchKeys = collections.Select(c => $"\"{c.ToLowerInvariant()}\"").ToArray();
        int maxKeyLen = searchKeys.Length > 0 ? searchKeys.Max(k => k.Length) : 50;

        bool negate = false;
        bool inQuote = false;
        int braceCount = 0;
        string? foundCollectionName = null;
        JsonObjectRange? currentObject = null;
        int itemIndex = -1;

        // Use a circular buffer approach for collection name detection
        var nameBuf = new byte[maxKeyLen + 2];
        int nameBufLen = 0;

        for (int i = 0; i < bytes.Length; i++)
        {
            byte b = bytes[i];

            if (foundCollectionName == null)
            {
                // Slide the name buffer
                if (nameBufLen < nameBuf.Length)
                    nameBuf[nameBufLen++] = b;
                else
                {
                    // Shift left by 1
                    Array.Copy(nameBuf, 1, nameBuf, 0, nameBuf.Length - 1);
                    nameBuf[^1] = b;
                }

                // Check if buffer ends with any search key
                string bufStr = Encoding.UTF8.GetString(nameBuf, 0, nameBufLen).ToLowerInvariant();
                for (int k = 0; k < searchKeys.Length; k++)
                {
                    if (bufStr.EndsWith(searchKeys[k], StringComparison.Ordinal))
                    {
                        foundCollectionName = collections[k];
                        nameBufLen = 0;
                        Log($"Found collection: {foundCollectionName}");
                        break;
                    }
                }
                continue;
            }

            // Handle escape sequences
            bool isEscape = false;
            if (b == ByteBackslash)
            {
                negate = !negate;
                isEscape = true;
            }

            if (b == ByteQuote && !negate)
            {
                inQuote = !inQuote;
                if (!isEscape) negate = false;
                continue;
            }

            if (!isEscape) negate = false;
            if (inQuote) continue;

            switch (b)
            {
                case ByteOpenBrace:
                    braceCount++;
                    if (braceCount == 1)
                        currentObject = new JsonObjectRange { StartPosition = i, ItemIndex = itemIndex + 1 };
                    break;

                case ByteCloseBrace:
                    braceCount--;
                    if (braceCount == 0 && currentObject != null)
                    {
                        itemIndex++;
                        await ProcessFoundObject(currentObject, bytes, i, options, foundCollectionName, collectionItems, errors);
                        currentObject = null;
                    }
                    break;

                case ByteCloseBracket:
                    if (braceCount == 0)
                    {
                        foundCollectionName = null;
                        nameBufLen = 0;
                        itemIndex = -1;
                    }
                    break;
            }
        }

        return collectionItems.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value.ToArray(),
            StringComparer.OrdinalIgnoreCase);
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private Task ProcessFoundObject(
        JsonObjectRange objectRange, byte[] bytes, int endIndex,
        JsonScanOptions options, string collectionName,
        Dictionary<string, List<JsonObjectRange>> collectionItems,
        List<string> errors)
    {
        try
        {
            objectRange.Length = endIndex - objectRange.StartPosition + 1;

            if (objectRange.Length > options.MaxObjectSize)
            {
                objectRange.Error = $"Object size ({objectRange.Length}) exceeds maximum ({options.MaxObjectSize})";
                if (!options.ContinueOnError) return Task.CompletedTask;
            }

            // Array segment — avoids Span in async context
            int start = (int)objectRange.StartPosition;
            int len = (int)objectRange.Length;
            string text = Encoding.UTF8.GetString(bytes, start, len);

            if (options.IncludeJsonContent)
                objectRange.JsonContent = text;

            if (options.CalculateHashes)
                objectRange.Hash = ComputeMd5HexFromArray(bytes, start, len);

            if (options.PropertyExtractor != null)
            {
                try { objectRange.Properties = options.PropertyExtractor(text); }
                catch (Exception ex)
                {
                    objectRange.Error = $"Property extraction failed: {ex.Message}";
                    if (!options.ContinueOnError) return Task.CompletedTask;
                }
            }

            if (!_validator.IsValidJsonStructure(text))
            {
                objectRange.Error = "Invalid JSON structure";
                if (!options.ContinueOnError) return Task.CompletedTask;
            }

            if (!collectionItems.TryGetValue(collectionName, out var list))
            {
                list = new List<JsonObjectRange>();
                collectionItems[collectionName] = list;
            }
            list.Add(objectRange);
        }
        catch (Exception ex)
        {
            objectRange.Error = ex.Message;
            errors.Add($"Error processing object at position {objectRange.StartPosition}: {ex.Message}");
            if (options.ContinueOnError)
            {
                if (!collectionItems.ContainsKey(collectionName))
                    collectionItems[collectionName] = new List<JsonObjectRange>();
                collectionItems[collectionName].Add(objectRange);
            }
        }

        return Task.CompletedTask;
    }

    private static async Task<string[]> DetectCollections(byte[] bytes)
    {
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string[] candidates = ["items", "data", "results", "products", "records", "entries", "list", "array"];
        string text = Encoding.UTF8.GetString(bytes).ToLowerInvariant();
        foreach (string c in candidates)
            if (text.Contains($"\"{c}\"", StringComparison.Ordinal))
                found.Add(c);
        return await Task.FromResult(found.ToArray());
    }

    /// <summary>Compute MD5 from array segment — safe for use in sync methods.</summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ComputeMd5HexFromArray(byte[] data, int offset, int count)
    {
        using var md5 = MD5.Create();
        byte[] hash = md5.ComputeHash(data, offset, count);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private void Log(string message)
    {
        _logger?.LogInformation("{Message}", message);
    }
}
