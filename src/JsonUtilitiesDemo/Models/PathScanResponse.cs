namespace JsonUtilitiesDemo.Models;

public class PathScanResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public ObjectInfo[]? Objects { get; set; }
    public ScanStats? Stats { get; set; }
}
