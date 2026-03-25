namespace JsonUtilities.Models;

public class JsonPathScanResult
{
    public string JsonPath { get; set; } = string.Empty;
    public JsonObjectRange[] Objects { get; set; } = [];
    public ScanMetadata Metadata { get; set; } = new();
    public string[] ValidationErrors { get; set; } = [];
    public bool HasErrors => ValidationErrors.Length > 0;
}
