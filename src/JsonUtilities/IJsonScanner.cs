using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities;

public interface IJsonScanner
{
    Task<JsonScanResult> ScanAsync(string filePath, JsonScanOptions options);
    Task<JsonScanResult> ScanAsync(Stream stream, JsonScanOptions options);
}
