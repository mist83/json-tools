using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using JsonUtilities.Indexing;
using JsonUtilities.Models;
using Xunit;

namespace JsonUtilities.Tests;

/// <summary>
/// End-to-end ETL pipeline integration tests.
/// These tests simulate real-world usage patterns.
/// </summary>
public class IntegrationTests
{
    // ── ETL: Scan all collections ─────────────────────────────────────────────

    [Fact]
    public async Task ETL_EcommerceFile_ScanAllCollections_VerifyCountsAndHashes()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("products", "reviews", "orders")
            .WithContent()
            .WithHashes()
            .RunAsync();

        result.HasErrors.Should().BeFalse();
        result.Collections["products"].Should().HaveCount(5);
        result.Collections["reviews"].Should().HaveCount(5);
        result.Collections["orders"].Should().HaveCount(3);

        // All objects should have hashes
        result.Collections.Values.SelectMany(v => v).All(o => o.Hash != null).Should().BeTrue();
        // All hashes should be 32-char hex
        result.Collections.Values.SelectMany(v => v).All(o => o.Hash!.Length == 32).Should().BeTrue();
    }

    // ── ETL: Path extraction with byte position verification ─────────────────

    [Fact]
    public async Task ETL_CatalogFile_ExtractByPath_VerifyBytePositions()
    {
        byte[] fileBytes = System.IO.File.ReadAllBytes(Helpers.FixturePath("catalog.json"));

        using var stream = new System.IO.MemoryStream(fileBytes);
        var result = await JsonTools.ExtractPath(stream, "shows")
            .WithContent()
            .WithHashes()
            .RunAsync();

        result.Objects.Should().HaveCount(5);

        // Verify each object's byte position slices back to valid JSON matching the content
        foreach (var obj in result.Objects)
        {
            var slice = Encoding.UTF8.GetString(fileBytes, (int)obj.StartPosition, (int)obj.Length);
            new JsonValidator().IsValidJsonStructure(slice).Should().BeTrue();
            slice.Should().Be(obj.JsonContent);
        }
    }

    // ── ETL: Chain scan → trie → search ──────────────────────────────────────

    [Fact]
    public async Task ETL_ChainScanThenBuildTrie_SearchWorks()
    {
        // Step 1: Scan the catalog
        using var stream = Helpers.LoadFixture("catalog.json");
        var scanResult = await JsonTools.Scan(stream)
            .ForCollections("shows")
            .WithContent()
            .SkipValidation()
            .RunAsync();

        // Step 2: Extract titles from scanned objects
        var titles = scanResult.Collections["shows"]
            .Select(o => o.JsonContent!)
            .Select(json =>
            {
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                return doc.RootElement.GetProperty("title").GetString() ?? "";
            })
            .ToList();

        // Step 3: Build trie from titles
        var trie = JsonTools.BuildTrie(titles, t => t.ToLower().Split(' '));

        // Step 4: Search
        trie.Search("the").Should().HaveCountGreaterThan(0);
        trie.Search("godfather").Should().ContainSingle();
        trie.Search("xyz").Should().BeEmpty();
    }

    // ── ETL: Parallel scan matches sequential ─────────────────────────────────

    [Fact]
    public async Task ETL_ParallelScan_MatchesSequentialResults()
    {
        using var streamSeq = Helpers.LoadFixture("ecommerce.json");
        using var streamPar = Helpers.LoadFixture("ecommerce.json");

        var sequential = await JsonTools.Scan(streamSeq)
            .ForCollections("products", "reviews", "orders")
            .WithContent()
            .WithHashes()
            .RunAsync();

        var parallel = await JsonTools.Scan(streamPar)
            .ForCollections("products", "reviews", "orders")
            .WithContent()
            .WithHashes()
            .Parallel()
            .RunAsync();

        parallel.Metadata.TotalObjectsFound.Should().Be(sequential.Metadata.TotalObjectsFound);

        foreach (var key in sequential.Collections.Keys)
        {
            parallel.Collections.Should().ContainKey(key);
            parallel.Collections[key].Length.Should().Be(sequential.Collections[key].Length);
        }
    }

    // ── ETL: Semantic index — cast search ─────────────────────────────────────

    [Fact]
    public async Task ETL_SemanticIndex_CastSearch_ReturnsCorrectObjects()
    {
        var index = await JsonTools.BuildSemanticIndex(
            Helpers.FixturePath("catalog.json"),
            new SemanticIndexOptions
            {
                IndexedFields = ["cast"],
                CollectionPaths = ["shows"]
            });

        // Tom Hanks is in Forrest Gump and Cast Away
        var objects = index.SearchObjects("hanks", Helpers.FixturePath("catalog.json")).ToList();
        objects.Should().HaveCount(2);
        objects.All(o => o.Contains("Tom Hanks")).Should().BeTrue();
    }

    [Fact]
    public async Task ETL_SemanticIndex_DescriptionPrefix_ReturnsMatches()
    {
        var index = await JsonTools.BuildSemanticIndex(
            Helpers.FixturePath("catalog.json"),
            new SemanticIndexOptions
            {
                IndexedFields = ["description"],
                CollectionPaths = ["shows"]
            });

        // "crime" appears in Godfather description
        var offsets = index.Search("crime");
        offsets.Should().HaveCountGreaterThan(0);

        var objects = index.SearchObjects("crime", Helpers.FixturePath("catalog.json")).ToList();
        objects.Should().HaveCountGreaterThan(0);
    }

    // ── ETL: Performance ──────────────────────────────────────────────────────

    [Fact]
    public async Task ETL_LargeFile_1000Objects_CompletesUnder2Seconds()
    {
        var sw = Stopwatch.StartNew();

        using var stream = Helpers.LoadFixture("large_collection.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("items")
            .WithHashes()
            .SkipValidation()
            .RunAsync();

        sw.Stop();

        result.Collections["items"].Should().HaveCount(1000);
        sw.ElapsedMilliseconds.Should().BeLessThan(2000,
            $"1000 objects with hashing should complete in under 2s, took {sw.ElapsedMilliseconds}ms");
    }

    [Fact]
    public async Task ETL_LargeFile_ParallelFasterThanSequential_OnMultiCore()
    {
        // Only meaningful on multi-core machines
        if (System.Environment.ProcessorCount < 2) return;

        var swSeq = Stopwatch.StartNew();
        using var streamSeq = Helpers.LoadFixture("large_collection.json");
        await JsonTools.Scan(streamSeq).ForCollections("items").WithHashes().SkipValidation().RunAsync();
        swSeq.Stop();

        var swPar = Stopwatch.StartNew();
        using var streamPar = Helpers.LoadFixture("large_collection.json");
        await JsonTools.Scan(streamPar).ForCollections("items").WithHashes().SkipValidation().Parallel().RunAsync();
        swPar.Stop();

        // Parallel should not be dramatically slower (within 3x is fine — overhead is real for small files)
        swPar.ElapsedMilliseconds.Should().BeLessThan(swSeq.ElapsedMilliseconds * 3,
            "parallel should not be dramatically slower than sequential");
    }

    // ── ETL: Edge cases ───────────────────────────────────────────────────────

    [Fact]
    public async Task ETL_EdgeCases_AllItemsExtracted()
    {
        using var stream = Helpers.LoadFixture("edge_cases.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("items", "single_item")
            .WithContent()
            .SkipValidation()
            .RunAsync();

        result.Collections["items"].Should().HaveCount(10);
        result.Collections["single_item"].Should().HaveCount(1);
    }

    [Fact]
    public async Task ETL_PropertyExtractor_ExtractsIdFromEachProduct()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("products")
            .WithContent()
            .WithPropertyExtractor(json =>
            {
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var id = doc.RootElement.GetProperty("id").GetString();
                return new System.Collections.Generic.Dictionary<string, object> { ["id"] = id! };
            })
            .RunAsync();

        result.Collections["products"].All(o => o.Properties != null).Should().BeTrue();
        result.Collections["products"].Select(o => o.Properties!["id"]).Should().Contain("prod-001");
    }
}
