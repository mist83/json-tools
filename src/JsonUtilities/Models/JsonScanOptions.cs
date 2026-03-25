using System;
using System.Collections.Generic;

namespace JsonUtilities.Models;

/// <summary>
/// Configuration options for <see cref="JsonUtilities.IJsonScanner"/> byte-range scan operations.
/// All options have sensible defaults suitable for most ETL workloads.
/// </summary>
public class JsonScanOptions
{
    /// <summary>
    /// Gets or sets the collection names to scan (e.g. <c>["products", "reviews"]</c>).
    /// When <c>null</c>, the scanner auto-detects common collection names.
    /// </summary>
    public string[]? TargetCollections { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether to validate UTF-8 delimiter safety before scanning.
    /// Disable for trusted ASCII-only input to improve throughput. Default: <c>true</c>.
    /// </summary>
    public bool ValidateUtf8 { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether to compute an MD5 hex hash for each extracted object.
    /// Useful for change detection in ETL pipelines. Default: <c>true</c>.
    /// </summary>
    public bool CalculateHashes { get; set; } = true;

    /// <summary>
    /// Gets or sets an optional delegate that extracts a property dictionary from each object's JSON text.
    /// Invoked after the object is located but before it is added to the result collection.
    /// </summary>
    public Func<string, Dictionary<string, object>>? PropertyExtractor { get; set; }

    /// <summary>
    /// Gets or sets the maximum allowed size in bytes for a single JSON object.
    /// Objects exceeding this limit are skipped (with an error recorded). Default: 10 MB.
    /// </summary>
    public long MaxObjectSize { get; set; } = 10 * 1024 * 1024;

    /// <summary>
    /// Gets or sets a value indicating whether to include the raw JSON text in each <see cref="JsonObjectRange.JsonContent"/>.
    /// Disable to reduce memory usage when only byte positions are needed. Default: <c>false</c>.
    /// </summary>
    public bool IncludeJsonContent { get; set; }

    /// <summary>
    /// Gets or sets the file I/O buffer size in bytes used when reading from disk.
    /// Larger values improve throughput for large files. Default: 64 KB.
    /// </summary>
    public int BufferSize { get; set; } = 65536;

    /// <summary>
    /// Gets or sets a value indicating whether to continue scanning after encountering an error.
    /// When <c>true</c>, errors are recorded in <see cref="JsonScanResult.ValidationErrors"/> and scanning continues.
    /// Default: <c>true</c>.
    /// </summary>
    public bool ContinueOnError { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether to process found objects in parallel using a
    /// producer/consumer channel. The byte scan itself remains sequential; parallelism applies
    /// to hashing, validation, and property extraction. Default: <c>false</c>.
    /// </summary>
    public bool ParallelProcessing { get; set; } = false;

    /// <summary>
    /// Gets or sets a value indicating whether to skip <c>JsonDocument.Parse</c> structure validation
    /// on each extracted object. Set to <c>true</c> for trusted input to significantly improve throughput.
    /// Default: <c>false</c>.
    /// </summary>
    public bool SkipStructureValidation { get; set; } = false;
}
