using System.Collections.Generic;

namespace JsonUtilities.Models;

public class JsonScanResult
{
    public Dictionary<string, JsonObjectRange[]> Collections { get; set; } = new();
    public ScanMetadata Metadata { get; set; } = new();
    public string[] ValidationErrors { get; set; } = [];
    public bool HasErrors => ValidationErrors.Length > 0;
}
