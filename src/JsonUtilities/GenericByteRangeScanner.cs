using System;
using System.Buffers;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using JsonUtilities.Models;
using Microsoft.Extensions.Logging;

namespace JsonUtilities;

/// <summary>
/// High-performance byte-range scanner for JSON collections.
/// Scans raw bytes without full deserialization to locate JSON objects within named collections,
/// returning precise byte positions suitable for targeted partial-file reads in ETL pipelines.
/// </summary>
/// <remarks>
/// <para>
/// The scanner reads the entire stream into a pooled <see cref="ArrayPool{T}"/> buffer, then performs
/// a single sequential pass over the bytes to locate object boundaries. This approach avoids
/// repeated allocations and is cache-friendly for large files.
/// </para>
/// <para>
/// When <see cref="JsonScanOptions.ParallelProcessing"/> is enabled, object processing (hashing,
/// validation, property extraction) is offloaded to a <see cref="Channel{T}"/> consumer running
/// on the thread pool. The byte scan itself remains sequential — you cannot parallelize a
/// stateful byte-by-byte state machine.
/// </para>
/// </remarks>
public class GenericByteRangeScanner : IJsonScanner
{
    private readonly IJsonValidator _validator;
    private readonly ILogger<GenericByteRangeScanner>? _logger;

    private const byte ByteBackslash = (byte)'\\';
    private const byte ByteQuote = (byte)'"';
    private const byte ByteOpenBrace = (byte)'{';
    private const byte ByteCloseBrace = (byte)'}';
    private const byte ByteCloseBracket = (byte)']';

    /// <summary>
    /// Initializes a new <see cref="GenericByteRangeScanner"/> with optional validator and logger.
    /// </summary>
    /// <param name="validator">Custom validator implementation. Defaults to <see cref="JsonValidator"/> when <c>null</c>.</param>
    /// <param name="logger">Optional logger for progress and error messages.</param>
    public GenericByteRangeScanner(IJsonValidator? validator = null, ILogger<GenericByteRangeScanner>? logger = null)
    {
        _validator = validator ?? new JsonValidator();
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<JsonScanResult> ScanAsync(string filePath, JsonScanOptions options)
    {
        if (!File.Exists(filePath))
            return new JsonScanResult { ValidationErrors = [$"File not found: {filePath}"] };

        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read,
            FileShare.Read, options.BufferSize, useAsync: true);
        var result = await ScanAsync(stream, options);
        result.Metadata.FilesProcessed = 1;
        return result;
    }

    /// <inheritdoc/>
    public async Task<JsonScanResult> ScanAsync(Stream stream, JsonScanOptions options)
    {
        var metadata = new ScanMetadata { StartTime = DateTime.UtcNow };
        var result = new JsonScanResult { Metadata = metadata };
        var errors = new List<string>();

        try
        {
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

                Dictionary<string, JsonObjectRange[]> collections;
                if (options.ParallelProcessing)
                    collections = await ScanForCollectionsParallel(rentedBuffer, length, options, errors, metadata);
                else
                    collections = await ScanForCollections(rentedBuffer, length, options, errors);

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

    // ── Sequential scan ──────────────────────────────────────────────────────

    private async Task<Dictionary<string, JsonObjectRange[]>> ScanForCollections(
        byte[] bytes, int length, JsonScanOptions options, List<string> errors)
    {
        var collectionItems = new Dictionary<string, List<JsonObjectRange>>(StringComparer.OrdinalIgnoreCase);
        string[] collections = options.TargetCollections ?? await DetectCollections(bytes, length);

        var searchKeys = collections.Select(c => $"\"{c.ToLowerInvariant()}\"").ToArray();
        int maxKeyLen = searchKeys.Length > 0 ? searchKeys.Max(k => k.Length) : 50;

        bool negate = false;
        bool inQuote = false;
        int braceCount = 0;
        string? foundCollectionName = null;
        JsonObjectRange? currentObject = null;
        int itemIndex = -1;

        var nameBuf = new byte[maxKeyLen + 2];
        int nameBufLen = 0;

        for (int i = 0; i < length; i++)
        {
            byte b = bytes[i];

            if (foundCollectionName == null)
            {
                if (nameBufLen < nameBuf.Length)
                    nameBuf[nameBufLen++] = b;
                else
                {
                    Array.Copy(nameBuf, 1, nameBuf, 0, nameBuf.Length - 1);
                    nameBuf[^1] = b;
                }

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

            bool isEscape = false;
            if (b == ByteBackslash) { negate = !negate; isEscape = true; }

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
                        ProcessFoundObject(currentObject, bytes, i, options, foundCollectionName, collectionItems, errors);
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

    // ── Parallel scan (Channel<T> producer/consumer) ─────────────────────────

    private async Task<Dictionary<string, JsonObjectRange[]>> ScanForCollectionsParallel(
        byte[] bytes, int length, JsonScanOptions options, List<string> errors, ScanMetadata metadata)
    {
        int workerCount = Math.Max(1, Environment.ProcessorCount - 1);
        metadata.ParallelWorkers = workerCount;

        // Channel: producer (byte scanner) → consumers (object processors)
        var channel = Channel.CreateBounded<(JsonObjectRange range, string collectionName, int start, int len)>(
            new BoundedChannelOptions(workerCount * 4)
            {
                SingleWriter = true,
                SingleReader = false,
                FullMode = BoundedChannelFullMode.Wait
            });

        var concurrentResults = new ConcurrentDictionary<string, ConcurrentBag<JsonObjectRange>>(StringComparer.OrdinalIgnoreCase);
        var concurrentErrors = new ConcurrentBag<string>();

        // Start consumer workers
        var workers = Enumerable.Range(0, workerCount).Select(_ => Task.Run(async () =>
        {
            await foreach (var (range, collectionName, start, len) in channel.Reader.ReadAllAsync())
            {
                ProcessFoundObjectParallel(range, bytes, start, len, options, collectionName, concurrentResults, concurrentErrors);
            }
        })).ToArray();

        // Producer: sequential byte scan
        string[] collections = options.TargetCollections ?? await DetectCollections(bytes, length);
        var searchKeys = collections.Select(c => $"\"{c.ToLowerInvariant()}\"").ToArray();
        int maxKeyLen = searchKeys.Length > 0 ? searchKeys.Max(k => k.Length) : 50;

        bool negate = false, inQuote = false;
        int braceCount = 0;
        string? foundCollectionName = null;
        JsonObjectRange? currentObject = null;
        int itemIndex = -1;
        var nameBuf = new byte[maxKeyLen + 2];
        int nameBufLen = 0;

        for (int i = 0; i < length; i++)
        {
            byte b = bytes[i];

            if (foundCollectionName == null)
            {
                if (nameBufLen < nameBuf.Length) nameBuf[nameBufLen++] = b;
                else { Array.Copy(nameBuf, 1, nameBuf, 0, nameBuf.Length - 1); nameBuf[^1] = b; }

                string bufStr = Encoding.UTF8.GetString(nameBuf, 0, nameBufLen).ToLowerInvariant();
                for (int k = 0; k < searchKeys.Length; k++)
                {
                    if (bufStr.EndsWith(searchKeys[k], StringComparison.Ordinal))
                    {
                        foundCollectionName = collections[k];
                        nameBufLen = 0;
                        break;
                    }
                }
                continue;
            }

            bool isEscape = false;
            if (b == ByteBackslash) { negate = !negate; isEscape = true; }
            if (b == ByteQuote && !negate) { inQuote = !inQuote; if (!isEscape) negate = false; continue; }
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
                        int start = (int)currentObject.StartPosition;
                        int len = i - start + 1;
                        currentObject.Length = len;
                        await channel.Writer.WriteAsync((currentObject, foundCollectionName, start, len));
                        currentObject = null;
                    }
                    break;

                case ByteCloseBracket:
                    if (braceCount == 0) { foundCollectionName = null; nameBufLen = 0; itemIndex = -1; }
                    break;
            }
        }

        channel.Writer.Complete();
        await Task.WhenAll(workers);

        // Merge concurrent errors
        foreach (var e in concurrentErrors) errors.Add(e);

        return concurrentResults.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value.OrderBy(r => r.ItemIndex).ToArray(),
            StringComparer.OrdinalIgnoreCase);
    }

    // ── Object processing (sequential) ───────────────────────────────────────

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private void ProcessFoundObject(
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
                if (!options.ContinueOnError) return;
            }

            int start = (int)objectRange.StartPosition;
            int len = (int)objectRange.Length;
            string text = Encoding.UTF8.GetString(bytes, start, len);

            if (options.IncludeJsonContent) objectRange.JsonContent = text;
            if (options.CalculateHashes) objectRange.Hash = ComputeMd5HexFromArray(bytes, start, len);

            if (options.PropertyExtractor != null)
            {
                try { objectRange.Properties = options.PropertyExtractor(text); }
                catch (Exception ex)
                {
                    objectRange.Error = $"Property extraction failed: {ex.Message}";
                    if (!options.ContinueOnError) return;
                }
            }

            if (!options.SkipStructureValidation && !_validator.IsValidJsonStructure(text))
            {
                objectRange.Error = "Invalid JSON structure";
                if (!options.ContinueOnError) return;
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
    }

    // ── Object processing (parallel worker) ──────────────────────────────────

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private void ProcessFoundObjectParallel(
        JsonObjectRange objectRange, byte[] bytes, int start, int len,
        JsonScanOptions options, string collectionName,
        ConcurrentDictionary<string, ConcurrentBag<JsonObjectRange>> results,
        ConcurrentBag<string> errors)
    {
        try
        {
            if (objectRange.Length > options.MaxObjectSize)
            {
                objectRange.Error = $"Object size ({objectRange.Length}) exceeds maximum ({options.MaxObjectSize})";
                if (!options.ContinueOnError) return;
            }

            string text = Encoding.UTF8.GetString(bytes, start, len);

            if (options.IncludeJsonContent) objectRange.JsonContent = text;
            if (options.CalculateHashes) objectRange.Hash = ComputeMd5HexFromArray(bytes, start, len);

            if (options.PropertyExtractor != null)
            {
                try { objectRange.Properties = options.PropertyExtractor(text); }
                catch (Exception ex)
                {
                    objectRange.Error = $"Property extraction failed: {ex.Message}";
                    if (!options.ContinueOnError) return;
                }
            }

            if (!options.SkipStructureValidation && !_validator.IsValidJsonStructure(text))
            {
                objectRange.Error = "Invalid JSON structure";
                if (!options.ContinueOnError) return;
            }

            results.GetOrAdd(collectionName, _ => new ConcurrentBag<JsonObjectRange>()).Add(objectRange);
        }
        catch (Exception ex)
        {
            objectRange.Error = ex.Message;
            errors.Add($"Error processing object at position {objectRange.StartPosition}: {ex.Message}");
            if (options.ContinueOnError)
                results.GetOrAdd(collectionName, _ => new ConcurrentBag<JsonObjectRange>()).Add(objectRange);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<string[]> DetectCollections(byte[] bytes, int length)
    {
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string[] candidates = ["items", "data", "results", "products", "records", "entries", "list", "array"];
        string text = Encoding.UTF8.GetString(bytes, 0, length).ToLowerInvariant();
        foreach (string c in candidates)
            if (text.Contains($"\"{c}\"", StringComparison.Ordinal))
                found.Add(c);
        return await Task.FromResult(found.ToArray());
    }

    /// <summary>Computes an MD5 hex string from a segment of a byte array.</summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ComputeMd5HexFromArray(byte[] data, int offset, int count)
    {
        using var md5 = MD5.Create();
        byte[] hash = md5.ComputeHash(data, offset, count);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private void Log(string message) => _logger?.LogInformation("{Message}", message);
}
