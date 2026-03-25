using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities;

/// <summary>
/// Defines the contract for a high-performance JSON byte-range scanner.
/// Implementations scan raw bytes to locate JSON objects within named collections,
/// returning precise byte positions for efficient partial-file reads.
/// </summary>
public interface IJsonScanner
{
    /// <summary>
    /// Scans a JSON file at the specified path, extracting objects from named collections
    /// with byte-range positions and optional MD5 hashes.
    /// </summary>
    /// <param name="filePath">Absolute or relative path to the JSON file.</param>
    /// <param name="options">Scan configuration options.</param>
    /// <returns>A <see cref="JsonScanResult"/> containing all found collections and metadata.</returns>
    Task<JsonScanResult> ScanAsync(string filePath, JsonScanOptions options);

    /// <summary>
    /// Scans a JSON stream, extracting objects from named collections
    /// with byte-range positions and optional MD5 hashes.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <param name="options">Scan configuration options.</param>
    /// <returns>A <see cref="JsonScanResult"/> containing all found collections and metadata.</returns>
    Task<JsonScanResult> ScanAsync(Stream stream, JsonScanOptions options);
}
