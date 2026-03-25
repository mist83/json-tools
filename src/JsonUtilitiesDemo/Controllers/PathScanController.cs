using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using JsonUtilities;
using JsonUtilities.Models;
using JsonUtilitiesDemo.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JsonUtilitiesDemo.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PathScanController : ControllerBase
{
    private readonly ILogger<PathScanController> _logger;

    public PathScanController(ILogger<PathScanController> logger) => _logger = logger;

    /// <summary>Extract objects at a dot-notation JSON path (e.g. "company.departments.engineering.employees").</summary>
    [HttpPost("extract")]
    public async Task<IActionResult> ExtractByPath([FromBody] PathScanRequest request)
    {
        try
        {
            _logger.LogInformation("Path scan: {Path}", request.JsonPath);
            var sw = Stopwatch.StartNew();

            var options = new JsonPathScanOptions
            {
                CalculateHashes = true,
                IncludeJsonContent = true
            };

            var scanner = new GenericJsonPathScanner();
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(request.JsonContent));
            var result = await scanner.ScanAsync(stream, request.JsonPath, options);
            sw.Stop();

            return Ok(new PathScanResponse
            {
                Success = true,
                Objects = result.Objects.Select(o => new ObjectInfo
                {
                    StartPosition = o.StartPosition,
                    Length = o.Length,
                    ItemIndex = o.ItemIndex,
                    Hash = o.Hash,
                    JsonContent = o.JsonContent
                }).ToArray(),
                Stats = new ScanStats
                {
                    BytesProcessed = result.Metadata.BytesProcessed,
                    TotalObjectsFound = result.Metadata.TotalObjectsFound,
                    CollectionsScanned = 1,
                    ProcessingTimeMs = sw.Elapsed.TotalMilliseconds
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during path scan");
            return Ok(new PathScanResponse { Success = false, Error = ex.Message });
        }
    }
}
