namespace JsonUtilities.Models;

public class JsonPathScanOptions
{
    public bool ValidateUtf8 { get; set; } = false;
    public bool CalculateHashes { get; set; } = true;
    public bool IncludeJsonContent { get; set; } = true;
    public long MaxObjectSize { get; set; } = 10 * 1024 * 1024; // 10MB
    public bool ContinueOnError { get; set; } = true;
    public bool StrictMode { get; set; } = false;
}
