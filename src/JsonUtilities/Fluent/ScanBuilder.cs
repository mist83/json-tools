using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities.Fluent;

/// <summary>
/// Fluent builder for byte-range scan operations.
/// Chain configuration methods and call <see cref="RunAsync"/> to execute.
/// </summary>
/// <example>
/// <code>
/// var result = await JsonTools.Scan(stream)
///     .ForCollections("products", "reviews")
///     .WithHashes()
///     .WithContent()
///     .RunAsync();
/// </code>
/// </example>
public sealed class ScanBuilder
{
    private readonly Stream _stream;
    private readonly JsonScanOptions _options = new();

    internal ScanBuilder(Stream stream)
    {
        _stream = stream ?? throw new ArgumentNullException(nameof(stream));
    }

    /// <summary>
    /// Specifies the collection names to scan. When not called, collections are auto-detected.
    /// </summary>
    /// <param name="collections">One or more collection names (e.g. <c>"products"</c>, <c>"reviews"</c>).</param>
    public ScanBuilder ForCollections(params string[] collections)
    {
        _options.TargetCollections = collections;
        return this;
    }

    /// <summary>Enables MD5 hash computation for each extracted object.</summary>
    public ScanBuilder WithHashes()
    {
        _options.CalculateHashes = true;
        return this;
    }

    /// <summary>Includes the raw JSON text in each <see cref="JsonObjectRange.JsonContent"/>.</summary>
    public ScanBuilder WithContent()
    {
        _options.IncludeJsonContent = true;
        return this;
    }

    /// <summary>
    /// Registers a property extractor delegate invoked for each found object.
    /// </summary>
    /// <param name="extractor">A function that parses the JSON text and returns a property dictionary.</param>
    public ScanBuilder WithPropertyExtractor(Func<string, Dictionary<string, object>> extractor)
    {
        _options.PropertyExtractor = extractor;
        return this;
    }

    /// <summary>
    /// Skips <c>JsonDocument.Parse</c> structure validation for each object.
    /// Use for trusted input to significantly improve throughput.
    /// </summary>
    public ScanBuilder SkipValidation()
    {
        _options.SkipStructureValidation = true;
        _options.ValidateUtf8 = false;
        return this;
    }

    /// <summary>
    /// Enables parallel object processing via a <see cref="System.Threading.Channels.Channel{T}"/> producer/consumer.
    /// The byte scan remains sequential; hashing, validation, and extraction run in parallel.
    /// </summary>
    public ScanBuilder Parallel()
    {
        _options.ParallelProcessing = true;
        return this;
    }

    /// <summary>
    /// Sets the maximum allowed size in bytes for a single JSON object. Default: 10 MB.
    /// </summary>
    public ScanBuilder MaxObjectSize(long bytes)
    {
        _options.MaxObjectSize = bytes;
        return this;
    }

    /// <summary>Executes the scan and returns the result.</summary>
    /// <returns>A <see cref="JsonScanResult"/> containing all found collections and metadata.</returns>
    public Task<JsonScanResult> RunAsync()
    {
        var scanner = new GenericByteRangeScanner();
        return scanner.ScanAsync(_stream, _options);
    }

    /// <summary>
    /// Processes the stream incrementally, invoking <paramref name="processor"/> for each discovered object.
    /// Use this overload when you want bounded memory instead of collecting the entire result set first.
    /// </summary>
    public Task ProcessAsync(Action<string, JsonObjectRange> processor)
    {
        var scanner = new GenericByteRangeScanner();
        return scanner.ProcessStreamAsync(_stream, processor, _options);
    }
}
