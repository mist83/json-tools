using System;
using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities.Fluent;

/// <summary>
/// Fluent builder for dot-notation JSON path scan operations.
/// Chain configuration methods and call <see cref="RunAsync"/> to execute.
/// </summary>
/// <example>
/// <code>
/// var result = await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
///     .WithHashes()
///     .WithContent()
///     .RunAsync();
/// </code>
/// </example>
public sealed class PathScanBuilder
{
    private readonly Stream _stream;
    private readonly string _jsonPath;
    private readonly JsonPathScanOptions _options = new();

    internal PathScanBuilder(Stream stream, string jsonPath)
    {
        _stream = stream ?? throw new ArgumentNullException(nameof(stream));
        _jsonPath = jsonPath ?? throw new ArgumentNullException(nameof(jsonPath));
    }

    /// <summary>Enables MD5 hash computation for each extracted object.</summary>
    public PathScanBuilder WithHashes()
    {
        _options.CalculateHashes = true;
        return this;
    }

    /// <summary>Includes the raw JSON text in each <see cref="JsonObjectRange.JsonContent"/>.</summary>
    public PathScanBuilder WithContent()
    {
        _options.IncludeJsonContent = true;
        return this;
    }

    /// <summary>
    /// Enables case-sensitive path segment matching.
    /// By default, path matching is case-insensitive.
    /// </summary>
    public PathScanBuilder StrictMode()
    {
        _options.StrictMode = true;
        return this;
    }

    /// <summary>
    /// Skips <c>JsonDocument.Parse</c> structure validation for each object.
    /// Use for trusted input to improve throughput.
    /// </summary>
    public PathScanBuilder SkipValidation()
    {
        _options.SkipStructureValidation = true;
        _options.ValidateUtf8 = false;
        return this;
    }

    /// <summary>
    /// Sets the maximum allowed size in bytes for a single JSON object. Default: 10 MB.
    /// </summary>
    public PathScanBuilder MaxObjectSize(long bytes)
    {
        _options.MaxObjectSize = bytes;
        return this;
    }

    /// <summary>
    /// Sets the file I/O buffer size in bytes used while reading the JSON stream.
    /// Default: 64 KB.
    /// </summary>
    public PathScanBuilder BufferSize(int bytes)
    {
        _options.BufferSize = bytes;
        return this;
    }

    /// <summary>
    /// Processes matching objects incrementally, invoking <paramref name="processor"/> once per object.
    /// Use this overload to keep memory bounded when scanning large streams.
    /// </summary>
    public Task ProcessAsync(Action<JsonObjectRange> processor)
    {
        var scanner = new GenericJsonPathScanner();
        return scanner.ProcessStreamAsync(_stream, _jsonPath, processor, _options);
    }

    /// <summary>Executes the path scan and returns the result.</summary>
    /// <returns>A <see cref="JsonPathScanResult"/> containing all found objects and metadata.</returns>
    public Task<JsonPathScanResult> RunAsync()
    {
        var scanner = new GenericJsonPathScanner();
        return scanner.ScanAsync(_stream, _jsonPath, _options);
    }
}
