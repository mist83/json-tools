using System;
using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities;

public interface IJsonPathScanner
{
    Task<JsonPathScanResult> ScanAsync(string filePath, string jsonPath, JsonPathScanOptions options);
    Task<JsonPathScanResult> ScanAsync(Stream stream, string jsonPath, JsonPathScanOptions options);
    Task ProcessStreamAsync(Stream stream, string jsonPath, Action<JsonObjectRange> processor, JsonPathScanOptions options);
}
