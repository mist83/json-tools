using System.Collections.Generic;

namespace JsonUtilities.Models;

/// <summary>
/// The result of a byte-range scan operation, containing all discovered collections,
/// their objects with byte positions, and scan metadata.
/// </summary>
public class JsonScanResult
{
    /// <summary>
    /// Gets or sets a dictionary mapping collection names to their discovered objects.
    /// Each <see cref="JsonObjectRange"/> contains the byte position and optional content/hash.
    /// </summary>
    public Dictionary<string, JsonObjectRange[]> Collections { get; set; } = new();

    /// <summary>Gets or sets the scan timing and throughput statistics.</summary>
    public ScanMetadata Metadata { get; set; } = new();

    /// <summary>Gets or sets any validation or processing errors encountered during the scan.</summary>
    public string[] ValidationErrors { get; set; } = [];

    /// <summary>Gets a value indicating whether any errors were encountered during the scan.</summary>
    public bool HasErrors => ValidationErrors.Length > 0;
}
