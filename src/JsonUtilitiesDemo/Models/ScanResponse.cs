using System.Collections.Generic;

namespace JsonUtilitiesDemo.Models;

public class ScanResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public Dictionary<string, ObjectInfo[]>? Collections { get; set; }
    public ScanStats? Stats { get; set; }
}
