namespace JsonUtilitiesDemo.Models;

public class ScanStats
{
    public long BytesProcessed { get; set; }
    public int TotalObjectsFound { get; set; }
    public int CollectionsScanned { get; set; }
    public double ProcessingTimeMs { get; set; }
}
