namespace JsonUtilities.Models;

/// <summary>
/// Configuration options for <see cref="JsonUtilities.IJsonPathScanner"/> dot-notation path scan operations.
/// </summary>
public class JsonPathScanOptions
{
    /// <summary>
    /// Gets or sets a value indicating whether to validate UTF-8 delimiter safety before scanning.
    /// Default: <c>false</c> (path scanning is less sensitive to multi-byte sequences).
    /// </summary>
    public bool ValidateUtf8 { get; set; } = false;

    /// <summary>
    /// Gets or sets a value indicating whether to compute an MD5 hex hash for each extracted object.
    /// Default: <c>true</c>.
    /// </summary>
    public bool CalculateHashes { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether to include the raw JSON text in each <see cref="JsonObjectRange.JsonContent"/>.
    /// Default: <c>true</c>.
    /// </summary>
    public bool IncludeJsonContent { get; set; } = true;

    /// <summary>
    /// Gets or sets the maximum allowed size in bytes for a single JSON object.
    /// Default: 10 MB.
    /// </summary>
    public long MaxObjectSize { get; set; } = 10 * 1024 * 1024;

    /// <summary>
    /// Gets or sets a value indicating whether to continue scanning after encountering an error.
    /// Default: <c>true</c>.
    /// </summary>
    public bool ContinueOnError { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether path segment matching is case-sensitive.
    /// When <c>false</c> (default), path segments are compared case-insensitively.
    /// </summary>
    public bool StrictMode { get; set; } = false;

    /// <summary>
    /// Gets or sets a value indicating whether to skip <c>JsonDocument.Parse</c> structure validation
    /// on each extracted object. Set to <c>true</c> for trusted input to improve throughput.
    /// Default: <c>false</c>.
    /// </summary>
    public bool SkipStructureValidation { get; set; } = false;
}
