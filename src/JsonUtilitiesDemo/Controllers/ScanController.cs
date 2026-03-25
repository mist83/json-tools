using System;
using System.Collections.Generic;
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
public class ScanController : ControllerBase
{
    private readonly ILogger<ScanController> _logger;

    public ScanController(ILogger<ScanController> logger) => _logger = logger;

    /// <summary>Byte-range scan: extract objects from named collections with byte positions and optional MD5 hashes.</summary>
    [HttpPost("byte-range")]
    public async Task<IActionResult> ScanByteRange([FromBody] ScanRequest request)
    {
        try
        {
            _logger.LogInformation("Byte-range scan: {Bytes} bytes", request.JsonContent.Length);
            var sw = Stopwatch.StartNew();

            if (request.ValidateUtf8)
            {
                try { new JsonValidator().ValidateUtf8Safety(request.JsonContent); }
                catch (Exception ex)
                {
                    return Ok(new ScanResponse { Success = false, Error = $"Invalid UTF-8: {ex.Message}" });
                }
            }

            var options = new JsonScanOptions
            {
                TargetCollections = request.TargetCollections.Length > 0 ? request.TargetCollections : null,
                CalculateHashes = request.CalculateHashes,
                IncludeJsonContent = true
            };

            var scanner = new GenericByteRangeScanner();
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes(request.JsonContent));
            var scanResult = await scanner.ScanAsync(stream, options);
            sw.Stop();

            var collections = scanResult.Collections.ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value.Select(o => new ObjectInfo
                {
                    StartPosition = o.StartPosition,
                    Length = o.Length,
                    ItemIndex = o.ItemIndex,
                    Hash = o.Hash,
                    JsonContent = o.JsonContent
                }).ToArray());

            return Ok(new ScanResponse
            {
                Success = true,
                Collections = collections,
                Stats = new ScanStats
                {
                    BytesProcessed = scanResult.Metadata.BytesProcessed,
                    TotalObjectsFound = scanResult.Metadata.TotalObjectsFound,
                    CollectionsScanned = scanResult.Metadata.CollectionsScanned,
                    ProcessingTimeMs = sw.Elapsed.TotalMilliseconds
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during byte-range scan");
            return Ok(new ScanResponse { Success = false, Error = ex.Message });
        }
    }

    /// <summary>Validate JSON structure and UTF-8 safety.</summary>
    [HttpPost("validate")]
    public IActionResult ValidateJson([FromBody] ScanRequest request)
    {
        try
        {
            var validator = new JsonValidator();
            bool isValidUtf8 = true;
            string utf8Error = string.Empty;
            try { validator.ValidateUtf8Safety(request.JsonContent); }
            catch (Exception ex) { isValidUtf8 = false; utf8Error = ex.Message; }

            bool isValidStructure = validator.IsValidJsonStructure(request.JsonContent);
            return Ok(new
            {
                Success = true,
                IsValidUtf8 = isValidUtf8,
                Utf8Error = utf8Error,
                IsValidStructure = isValidStructure,
                BytesChecked = Encoding.UTF8.GetByteCount(request.JsonContent)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during validation");
            return Ok(new { Success = false, Error = ex.Message });
        }
    }
}
