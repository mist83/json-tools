using System;

namespace JsonUtilities.Models;

/// <summary>
/// Contains timing and throughput statistics for a completed scan operation.
/// </summary>
public class ScanMetadata
{
    /// <summary>Gets or sets the UTC timestamp when the scan began.</summary>
    public DateTime StartTime { get; set; }

    /// <summary>Gets or sets the UTC timestamp when the scan completed.</summary>
    public DateTime EndTime { get; set; }

    /// <summary>Gets or sets the total number of bytes read from the source stream.</summary>
    public long BytesProcessed { get; set; }

    /// <summary>Gets or sets the total number of JSON objects found across all collections.</summary>
    public int TotalObjectsFound { get; set; }

    /// <summary>Gets or sets the number of distinct collections scanned.</summary>
    public int CollectionsScanned { get; set; }

    /// <summary>Gets or sets the number of files processed (1 for stream-based scans).</summary>
    public int FilesProcessed { get; set; }

    /// <summary>Gets or sets the number of errors encountered during scanning.</summary>
    public int ErrorCount { get; set; }

    /// <summary>Gets or sets the number of parallel worker tasks used during object processing. 0 when parallel processing is disabled.</summary>
    public int ParallelWorkers { get; set; }

    /// <summary>Gets the total elapsed time for the scan operation.</summary>
    public TimeSpan Elapsed => EndTime - StartTime;
}
