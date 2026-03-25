using System;

namespace JsonUtilities.Models;

public class ScanMetadata
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public long BytesProcessed { get; set; }
    public int TotalObjectsFound { get; set; }
    public int CollectionsScanned { get; set; }
    public int FilesProcessed { get; set; }
    public int ErrorCount { get; set; }
    public TimeSpan Elapsed => EndTime - StartTime;
}
