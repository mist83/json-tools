using System;
using System.Collections.Generic;

namespace JsonUtilities.Models;

public class JsonScanOptions
{
    public string[]? TargetCollections { get; set; }
    public bool ValidateUtf8 { get; set; } = true;
    public bool CalculateHashes { get; set; } = true;
    public Func<string, Dictionary<string, object>>? PropertyExtractor { get; set; }
    public long MaxObjectSize { get; set; } = 10 * 1024 * 1024; // 10MB
    public bool IncludeJsonContent { get; set; }
    public int BufferSize { get; set; } = 65536; // 64KB — upgraded from 8KB
    public bool ContinueOnError { get; set; } = true;
}
