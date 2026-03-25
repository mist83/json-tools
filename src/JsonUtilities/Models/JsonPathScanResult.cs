namespace JsonUtilities.Models;

/// <summary>
/// The result of a dot-notation path scan operation, containing all objects found
/// at the specified JSON path with byte positions and optional content/hashes.
/// </summary>
public class JsonPathScanResult
{
    /// <summary>Gets or sets the dot-notation JSON path that was scanned (e.g. <c>company.departments.employees</c>).</summary>
    public string JsonPath { get; set; } = string.Empty;

    /// <summary>Gets or sets the array of objects found at the specified path.</summary>
    public JsonObjectRange[] Objects { get; set; } = [];

    /// <summary>Gets or sets the scan timing and throughput statistics.</summary>
    public ScanMetadata Metadata { get; set; } = new();

    /// <summary>Gets or sets any validation or processing errors encountered during the scan.</summary>
    public string[] ValidationErrors { get; set; } = [];

    /// <summary>Gets a value indicating whether any errors were encountered during the scan.</summary>
    public bool HasErrors => ValidationErrors.Length > 0;
}
