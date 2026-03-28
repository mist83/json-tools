namespace JsonUtilitiesDemo.Models;

public class ScanRequest
{
    public string JsonContent { get; set; } = string.Empty;
    public string[] TargetCollections { get; set; } = [];
    public bool CalculateHashes { get; set; } = true;
    public bool ValidateUtf8 { get; set; } = true;
    public bool ParallelProcessing { get; set; }
    public bool IncludeJsonContent { get; set; } = true;
}
