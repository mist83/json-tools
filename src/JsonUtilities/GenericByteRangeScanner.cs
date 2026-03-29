using System;
using System.Buffers;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
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
/// The scanner processes the source stream in fixed-size chunks and keeps only parser state plus the
/// current object in memory. This allows callers to process files larger than available RAM, as long as
/// downstream result accumulation is also kept bounded.
/// </para>
/// <para>
/// When <see cref="JsonScanOptions.ParallelProcessing"/> is enabled, object processing (hashing,
/// validation, property extraction) is offloaded to worker tasks. The byte scan itself remains
/// sequential because JSON boundary detection is inherently stateful.
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
    private const byte ByteOpenBracket = (byte)'[';
    private const byte ByteCloseBracket = (byte)']';
    private static readonly string[] DefaultCollectionCandidates = ["items", "data", "results", "products", "records", "entries", "list", "array"];
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

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
        var errors = new ConcurrentBag<string>();

        try
        {
            if (options.ParallelProcessing)
            {
                var collectionItems = new ConcurrentDictionary<string, ConcurrentBag<JsonObjectRange>>(StringComparer.OrdinalIgnoreCase);
                await ProcessStreamInternalAsync(
                    stream,
                    options,
                    workItem =>
                    {
                        var processed = ProcessCompletedObject(workItem, options, errors);
                        if (processed != null)
                            collectionItems.GetOrAdd(workItem.CollectionName, _ => new ConcurrentBag<JsonObjectRange>()).Add(processed);
                    },
                    metadata,
                    errors);

                result.Collections = collectionItems.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.OrderBy(r => r.ItemIndex).ToArray(),
                    StringComparer.OrdinalIgnoreCase);
            }
            else
            {
                var collectionItems = new Dictionary<string, List<JsonObjectRange>>(StringComparer.OrdinalIgnoreCase);
                await ProcessStreamInternalAsync(
                    stream,
                    options,
                    workItem =>
                    {
                        var processed = ProcessCompletedObject(workItem, options, errors);
                        if (processed == null) return;

                        if (!collectionItems.TryGetValue(workItem.CollectionName, out var list))
                        {
                            list = [];
                            collectionItems[workItem.CollectionName] = list;
                        }

                        list.Add(processed);
                    },
                    metadata,
                    errors);

                result.Collections = collectionItems.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.ToArray(),
                    StringComparer.OrdinalIgnoreCase);
            }

            metadata.TotalObjectsFound = result.Collections.Values.Sum(x => x.Length);
            metadata.CollectionsScanned = result.Collections.Count;
            Log($"Scan complete: {metadata.TotalObjectsFound} objects in {metadata.CollectionsScanned} collections.");
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

    /// <summary>
    /// Processes a JSON stream incrementally, invoking <paramref name="processor"/> for each object found
    /// in the requested collections.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <param name="processor">Callback invoked with the collection name and discovered object range.</param>
    /// <param name="options">Scan configuration options.</param>
    public Task ProcessStreamAsync(Stream stream, Action<string, JsonObjectRange> processor, JsonScanOptions options)
    {
        ArgumentNullException.ThrowIfNull(stream);
        ArgumentNullException.ThrowIfNull(processor);
        ArgumentNullException.ThrowIfNull(options);

        return ProcessStreamInternalAsync(
            stream,
            options,
            workItem =>
            {
                var processed = ProcessCompletedObject(workItem, options, errors: null);
                if (processed != null)
                    processor(workItem.CollectionName, processed);
            },
            metadata: null,
            errors: null);
    }

    internal Task ProcessBufferedStreamAsync(Stream stream, Action<string, BufferedJsonObject> processor, JsonScanOptions options)
    {
        ArgumentNullException.ThrowIfNull(stream);
        ArgumentNullException.ThrowIfNull(processor);
        ArgumentNullException.ThrowIfNull(options);

        if (options.ParallelProcessing)
            throw new NotSupportedException("Buffered object streaming does not support parallel processing.");

        var scanningOptions = CloneOptions(options);
        scanningOptions.IncludeJsonContent = true;

        return ProcessStreamInternalAsync(
            stream,
            scanningOptions,
            workItem =>
            {
                if (workItem.ExceededMaxSize || workItem.Range.Length > scanningOptions.MaxObjectSize)
                {
                    if (!scanningOptions.ContinueOnError)
                        throw new InvalidOperationException($"Object size ({workItem.Range.Length}) exceeds maximum ({scanningOptions.MaxObjectSize})");
                    return;
                }

                processor(workItem.CollectionName, new BufferedJsonObject(
                    workItem.Range.StartPosition,
                    workItem.Range.Length,
                    workItem.Range.ItemIndex,
                    workItem.Range.ObjectType,
                    workItem.Bytes));
            },
            metadata: null,
            errors: null);
    }

    private async Task ProcessStreamInternalAsync(
        Stream stream,
        JsonScanOptions options,
        Action<ObjectWorkItem> workItemProcessor,
        ScanMetadata? metadata,
        ConcurrentBag<string>? errors)
    {
        if (!stream.CanRead)
            throw new InvalidOperationException("Stream must be readable.");

        var collections = BuildCollectionLookup(options.TargetCollections);
        var shouldBufferObject = ShouldBufferObject(options);
        var chunkSize = Math.Max(16, options.BufferSize);
        byte[] chunk = ArrayPool<byte>.Shared.Rent(chunkSize);
        var utf8Validator = options.ValidateUtf8 ? new StreamingUtf8Validator() : null;
        var stringTokenBytes = new List<byte>(64);

        Channel<ObjectWorkItem>? channel = null;
        Task[] workers = [];
        Exception? scanFailure = null;

        try
        {
            if (options.ParallelProcessing)
            {
                int workerCount = Math.Max(1, Environment.ProcessorCount - 1);
                if (metadata != null) metadata.ParallelWorkers = workerCount;

                channel = Channel.CreateBounded<ObjectWorkItem>(new BoundedChannelOptions(workerCount * 4)
                {
                    SingleWriter = true,
                    SingleReader = false,
                    FullMode = BoundedChannelFullMode.Wait
                });

                workers = Enumerable.Range(0, workerCount).Select(_ => Task.Run(async () =>
                {
                    await foreach (var workItem in channel.Reader.ReadAllAsync())
                        workItemProcessor(workItem);
                })).ToArray();
            }

            long absoluteOffset = 0;
            int arrayDepth = 0;
            int activeCollectionArrayDepth = -1;
            int itemIndex = -1;
            bool inString = false;
            bool escape = false;
            bool captureStringToken = false;
            bool pendingStringToken = false;
            bool awaitingArrayValue = false;
            string? lastCompletedString = null;
            string? pendingPropertyName = null;
            string? activeCollectionName = null;
            ActiveObjectCapture? currentObject = null;

            int bytesRead;
            while ((bytesRead = await stream.ReadAsync(chunk.AsMemory(0, chunkSize))) > 0)
            {
                if (metadata != null) metadata.BytesProcessed += bytesRead;
                utf8Validator?.Validate(chunk.AsSpan(0, bytesRead), flush: false);

                for (int i = 0; i < bytesRead; i++)
                {
                    byte b = chunk[i];
                    long position = absoluteOffset++;

                    if (currentObject != null)
                        currentObject.Append(b, options.MaxObjectSize);

                    if (inString)
                    {
                        if (escape)
                        {
                            escape = false;
                            if (captureStringToken) stringTokenBytes.Add(b);
                            continue;
                        }

                        if (b == ByteBackslash)
                        {
                            escape = true;
                            if (captureStringToken) stringTokenBytes.Add(b);
                            continue;
                        }

                        if (b == ByteQuote)
                        {
                            inString = false;
                            if (captureStringToken)
                            {
                                lastCompletedString = Encoding.UTF8.GetString(stringTokenBytes.ToArray());
                                stringTokenBytes.Clear();
                                pendingStringToken = true;
                            }

                            continue;
                        }

                        if (captureStringToken) stringTokenBytes.Add(b);
                        continue;
                    }

                    if (char.IsWhiteSpace((char)b))
                        continue;

                    if (activeCollectionName == null)
                    {
                        if (awaitingArrayValue)
                        {
                            if (b == ByteOpenBracket)
                            {
                                arrayDepth++;
                                if (pendingPropertyName != null && collections.TryGetValue(pendingPropertyName, out var matchedCollection))
                                {
                                    activeCollectionName = matchedCollection;
                                    activeCollectionArrayDepth = arrayDepth;
                                    itemIndex = -1;
                                    Log($"Found collection: {activeCollectionName}");
                                }

                                awaitingArrayValue = false;
                                pendingPropertyName = null;
                                pendingStringToken = false;
                                lastCompletedString = null;
                                continue;
                            }

                            awaitingArrayValue = false;
                            pendingPropertyName = null;
                        }

                        if (pendingStringToken)
                        {
                            if (b == (byte)':')
                            {
                                pendingPropertyName = lastCompletedString;
                                awaitingArrayValue = true;
                                pendingStringToken = false;
                                lastCompletedString = null;
                                continue;
                            }

                            pendingStringToken = false;
                            lastCompletedString = null;
                        }
                    }

                    if (b == ByteQuote)
                    {
                        inString = true;
                        escape = false;
                        captureStringToken = activeCollectionName == null;
                        if (captureStringToken) stringTokenBytes.Clear();
                        continue;
                    }

                    switch (b)
                    {
                        case ByteOpenBracket:
                            arrayDepth++;
                            break;

                        case ByteOpenBrace:
                            if (activeCollectionName != null)
                            {
                                if (currentObject == null)
                                {
                                    currentObject = new ActiveObjectCapture(
                                        new JsonObjectRange
                                        {
                                            StartPosition = position,
                                            ItemIndex = itemIndex + 1,
                                            ObjectType = activeCollectionName
                                        },
                                        shouldBufferObject);
                                    currentObject.Append(ByteOpenBrace, options.MaxObjectSize);
                                }
                                else
                                {
                                    currentObject.Depth++;
                                }
                            }
                            break;

                        case ByteCloseBrace:
                            if (currentObject != null)
                            {
                                currentObject.Depth--;
                                if (currentObject.Depth == 0)
                                {
                                    itemIndex++;
                                    var workItem = currentObject.ToWorkItem(activeCollectionName!);
                                    currentObject = null;

                                    if (channel != null)
                                        await channel.Writer.WriteAsync(workItem);
                                    else
                                        workItemProcessor(workItem);
                                }
                            }
                            break;

                        case ByteCloseBracket:
                            if (activeCollectionName != null && currentObject == null && arrayDepth == activeCollectionArrayDepth)
                            {
                                activeCollectionName = null;
                                activeCollectionArrayDepth = -1;
                                itemIndex = -1;
                            }

                            if (arrayDepth > 0) arrayDepth--;
                            break;
                    }
                }
            }

            utf8Validator?.Validate(ReadOnlySpan<byte>.Empty, flush: true);

            if (currentObject != null)
            {
                currentObject.Range.Error = "Stream ended before JSON object was closed.";
                if (options.ContinueOnError)
                {
                    workItemProcessor(new ObjectWorkItem
                    {
                        CollectionName = activeCollectionName ?? currentObject.Range.ObjectType ?? "unknown",
                        Range = currentObject.Range,
                        ExceededMaxSize = currentObject.ExceededMaxSize
                    });
                }
                else
                    errors?.Add($"Incomplete JSON object starting at position {currentObject.Range.StartPosition}.");
            }
        }
        catch (Exception ex)
        {
            scanFailure = ex;
            throw;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(chunk);

            if (channel != null)
            {
                channel.Writer.TryComplete(scanFailure);
                await Task.WhenAll(workers);
            }
        }
    }

    // ── Object processing ────────────────────────────────────────────────────

    private JsonObjectRange? ProcessCompletedObject(
        ObjectWorkItem workItem,
        JsonScanOptions options,
        ConcurrentBag<string>? errors)
    {
        var objectRange = workItem.Range;

        try
        {
            if (workItem.ExceededMaxSize || objectRange.Length > options.MaxObjectSize)
            {
                objectRange.Error = $"Object size ({objectRange.Length}) exceeds maximum ({options.MaxObjectSize})";
                return options.ContinueOnError ? objectRange : null;
            }

            string? text = null;
            var bytes = workItem.Bytes;
            if (!bytes.IsEmpty)
                text = Encoding.UTF8.GetString(bytes.Span);

            if (options.IncludeJsonContent)
                objectRange.JsonContent = text;

            if (options.CalculateHashes && !bytes.IsEmpty)
                objectRange.Hash = ComputeMd5Hex(bytes.Span);

            if (options.PropertyExtractor != null)
            {
                try
                {
                    objectRange.Properties = options.PropertyExtractor(text ?? string.Empty);
                }
                catch (Exception ex)
                {
                    objectRange.Error = $"Property extraction failed: {ex.Message}";
                    return options.ContinueOnError ? objectRange : null;
                }
            }

            if (!options.SkipStructureValidation)
            {
                if (text == null || !_validator.IsValidJsonStructure(text))
                {
                    objectRange.Error = "Invalid JSON structure";
                    return options.ContinueOnError ? objectRange : null;
                }
            }

            return objectRange;
        }
        catch (Exception ex)
        {
            objectRange.Error = ex.Message;
            errors?.Add($"Error processing object at position {objectRange.StartPosition}: {ex.Message}");
            return options.ContinueOnError ? objectRange : null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static Dictionary<string, string> BuildCollectionLookup(string[]? collections)
    {
        var values = collections is { Length: > 0 } ? collections : DefaultCollectionCandidates;
        return values.ToDictionary(value => value, value => value, StringComparer.OrdinalIgnoreCase);
    }

    private static bool ShouldBufferObject(JsonScanOptions options)
    {
        return options.IncludeJsonContent
            || options.CalculateHashes
            || options.PropertyExtractor != null
            || !options.SkipStructureValidation;
    }

    private static JsonScanOptions CloneOptions(JsonScanOptions options)
    {
        return new JsonScanOptions
        {
            TargetCollections = options.TargetCollections,
            ValidateUtf8 = options.ValidateUtf8,
            CalculateHashes = options.CalculateHashes,
            PropertyExtractor = options.PropertyExtractor,
            MaxObjectSize = options.MaxObjectSize,
            IncludeJsonContent = options.IncludeJsonContent,
            BufferSize = options.BufferSize,
            ContinueOnError = options.ContinueOnError,
            ParallelProcessing = options.ParallelProcessing,
            SkipStructureValidation = options.SkipStructureValidation
        };
    }

    /// <summary>Computes an MD5 hex string for a byte array.</summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string ComputeMd5Hex(ReadOnlySpan<byte> data)
    {
        Span<byte> hash = stackalloc byte[16];
        MD5.HashData(data, hash);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private void Log(string message) => _logger?.LogInformation("{Message}", message);

    private sealed class ActiveObjectCapture
    {
        private readonly ArrayBufferWriter<byte>? _buffer;
        private readonly bool _captureBytes;

        public ActiveObjectCapture(JsonObjectRange range, bool captureBytes)
        {
            Range = range;
            Depth = 1;
            _captureBytes = captureBytes;
            _buffer = captureBytes ? new ArrayBufferWriter<byte>() : null;
        }

        public JsonObjectRange Range { get; }

        public int Depth { get; set; }

        public long Length { get; private set; }

        public bool ExceededMaxSize { get; private set; }

        public void Append(byte value, long maxObjectSize)
        {
            Length++;
            if (Length > maxObjectSize)
            {
                ExceededMaxSize = true;
                return;
            }

            if (!_captureBytes) return;

            var span = _buffer!.GetSpan(1);
            span[0] = value;
            _buffer.Advance(1);
        }

        public ObjectWorkItem ToWorkItem(string collectionName)
        {
            Range.Length = Length;
            return new ObjectWorkItem
            {
                CollectionName = collectionName,
                Range = Range,
                ExceededMaxSize = ExceededMaxSize,
                Buffer = _captureBytes && !ExceededMaxSize ? _buffer : null
            };
        }
    }

    private sealed class ObjectWorkItem
    {
        public required string CollectionName { get; init; }

        public required JsonObjectRange Range { get; init; }

        public required bool ExceededMaxSize { get; init; }

        public ArrayBufferWriter<byte>? Buffer { get; init; }

        public ReadOnlyMemory<byte> Bytes => Buffer?.WrittenMemory ?? ReadOnlyMemory<byte>.Empty;
    }

    internal readonly record struct BufferedJsonObject(
        long StartPosition,
        long Length,
        int ItemIndex,
        string? ObjectType,
        ReadOnlyMemory<byte> Bytes);

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
