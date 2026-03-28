using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using JsonUtilities;
using JsonUtilities.Indexing;
using JsonUtilities.Models;
using JsonUtilitiesDemo.Models;
using JsonUtilitiesDemo.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JsonUtilitiesDemo.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SemanticController : ControllerBase
{
    private readonly ILogger<SemanticController> _logger;

    public SemanticController(ILogger<SemanticController> logger) => _logger = logger;

    /// <summary>Build a semantic index from selected JSON fields, then search by keyword or prefix.</summary>
    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] SemanticSearchRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.SearchTerm))
                return Ok(new SemanticSearchResponse { Success = false, Error = "Search term is required." });

            var sw = Stopwatch.StartNew();
            var collectionPaths = JsonRequestHelpers.ResolveCollectionTargets(request.JsonContent, request.CollectionPaths) ?? [];
            var options = new SemanticIndexOptions
            {
                IndexedFields = request.IndexedFields,
                CollectionPaths = collectionPaths,
                IndexNGrams = request.IndexNGrams
            };

            var bytes = Encoding.UTF8.GetBytes(request.JsonContent);
            await using var indexStream = new MemoryStream(bytes, writable: false);
            var index = await JsonTools.BuildSemanticIndex(indexStream, options);

            string normalizedSearchTerm = options.CaseSensitive
                ? request.SearchTerm
                : request.SearchTerm.ToLowerInvariant();
            long[] matchedOffsets = index.Search(normalizedSearchTerm);

            await using var scanStream = new MemoryStream(bytes, writable: false);
            var scanResult = await JsonTools.CreateScanner().ScanAsync(scanStream, new JsonScanOptions
            {
                TargetCollections = collectionPaths.Length > 0 ? collectionPaths : null,
                IncludeJsonContent = true,
                CalculateHashes = false,
                ValidateUtf8 = false,
                SkipStructureValidation = true,
                ContinueOnError = true
            });

            var allObjects = scanResult.Collections.Values.SelectMany(static objects => objects).OrderBy(static obj => obj.StartPosition).ToArray();
            var offsetSet = matchedOffsets.ToHashSet();
            var matchedObjects = allObjects
                .Where(obj => offsetSet.Contains(obj.StartPosition))
                .Take(Math.Max(1, request.MaxResults))
                .Select(obj => new ObjectInfo
                {
                    StartPosition = obj.StartPosition,
                    Length = obj.Length,
                    ItemIndex = obj.ItemIndex,
                    Hash = obj.Hash,
                    JsonContent = obj.JsonContent
                })
                .ToArray();

            sw.Stop();
            return Ok(new SemanticSearchResponse
            {
                Success = true,
                Objects = matchedObjects,
                MatchedOffsets = matchedOffsets,
                IndexedFields = request.IndexedFields,
                CollectionPaths = collectionPaths,
                Stats = new SemanticSearchStats
                {
                    BytesProcessed = bytes.LongLength,
                    ObjectsIndexed = allObjects.Length,
                    MatchesFound = matchedOffsets.Length,
                    CollectionsScanned = scanResult.Collections.Count,
                    TermsIndexed = index.Count,
                    ProcessingTimeMs = sw.Elapsed.TotalMilliseconds
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during semantic search");
            return Ok(new SemanticSearchResponse { Success = false, Error = ex.Message });
        }
    }
}
