using System;
using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities;

/// <summary>
/// Defines the contract for a JSON path scanner that navigates nested JSON structures
/// using dot-notation paths (e.g. <c>company.departments.engineering.employees</c>).
/// </summary>
public interface IJsonPathScanner
{
    /// <summary>
    /// Scans a JSON file at the specified path, extracting all objects found at the given dot-notation JSON path.
    /// </summary>
    /// <param name="filePath">Absolute or relative path to the JSON file.</param>
    /// <param name="jsonPath">Dot-notation path to the target array (e.g. <c>company.departments.employees</c>).</param>
    /// <param name="options">Path scan configuration options.</param>
    /// <returns>A <see cref="JsonPathScanResult"/> containing all extracted objects and metadata.</returns>
    Task<JsonPathScanResult> ScanAsync(string filePath, string jsonPath, JsonPathScanOptions options);

    /// <summary>
    /// Scans a JSON stream, extracting all objects found at the given dot-notation JSON path.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <param name="jsonPath">Dot-notation path to the target array (e.g. <c>company.departments.employees</c>).</param>
    /// <param name="options">Path scan configuration options.</param>
    /// <returns>A <see cref="JsonPathScanResult"/> containing all extracted objects and metadata.</returns>
    Task<JsonPathScanResult> ScanAsync(Stream stream, string jsonPath, JsonPathScanOptions options);

    /// <summary>
    /// Processes a JSON stream, invoking a callback for each object found at the given dot-notation path.
    /// Use this overload for streaming ETL pipelines where you want to process objects one at a time
    /// without buffering all results in memory.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <param name="jsonPath">Dot-notation path to the target array.</param>
    /// <param name="processor">Callback invoked for each discovered <see cref="JsonObjectRange"/>.</param>
    /// <param name="options">Path scan configuration options.</param>
    Task ProcessStreamAsync(Stream stream, string jsonPath, Action<JsonObjectRange> processor, JsonPathScanOptions options);
}
