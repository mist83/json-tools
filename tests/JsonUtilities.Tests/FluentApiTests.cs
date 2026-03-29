using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using JsonUtilities.Indexing;
using Xunit;

namespace JsonUtilities.Tests;

public class FluentApiTests
{
    [Fact]
    public async Task JsonTools_Scan_Stream_ForCollections_WithContent_RunAsync()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("products", "reviews")
            .WithContent()
            .WithHashes()
            .RunAsync();

        result.Collections.Should().ContainKey("products");
        result.Collections.Should().ContainKey("reviews");
        result.Collections["products"].Should().HaveCount(5);
        result.Collections["products"].All(o => o.JsonContent != null).Should().BeTrue();
        result.Collections["products"].All(o => o.Hash != null).Should().BeTrue();
    }

    [Fact]
    public async Task JsonTools_Scan_Stream_SkipValidation_RunAsync()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("products")
            .SkipValidation()
            .RunAsync();

        result.Collections["products"].Should().HaveCount(5);
    }

    [Fact]
    public async Task JsonTools_Scan_Stream_Parallel_RunAsync()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await JsonTools.Scan(stream)
            .ForCollections("products", "reviews", "orders")
            .WithContent()
            .Parallel()
            .RunAsync();

        result.Metadata.TotalObjectsFound.Should().Be(13);
        result.Metadata.ParallelWorkers.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task JsonTools_Scan_Stream_ProcessAsync_StreamsObjects()
    {
        using var stream = Helpers.ToNonSeekableStream(@"{""items"":[{""id"":1},{""id"":2}]}", chunkSize: 3);
        var seen = new System.Collections.Generic.List<int>();

        await JsonTools.Scan(stream)
            .ForCollections("items")
            .WithContent()
            .ProcessAsync((collection, obj) =>
            {
                collection.Should().Be("items");
                seen.Add(obj.ItemIndex);
            });

        seen.Should().Equal(0, 1);
    }

    [Fact]
    public async Task JsonTools_Scan_FilePath_RunAsync()
    {
        var result = await JsonTools.Scan(Helpers.FixturePath("ecommerce.json"))
            .ForCollections("products")
            .RunAsync();

        result.Collections["products"].Should().HaveCount(5);
    }

    [Fact]
    public async Task JsonTools_ExtractPath_Stream_WithContent_RunAsync()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
            .WithContent()
            .WithHashes()
            .RunAsync();

        result.Objects.Should().HaveCount(3);
        result.Objects.All(o => o.JsonContent != null).Should().BeTrue();
        result.Objects.All(o => o.Hash != null).Should().BeTrue();
    }

    [Fact]
    public async Task JsonTools_ExtractPath_FilePath_RunAsync()
    {
        var result = await JsonTools.ExtractPath(
                Helpers.FixturePath("nested.json"),
                "company.departments.sales.employees")
            .WithContent()
            .RunAsync();

        result.Objects.Should().HaveCount(2);
    }

    [Fact]
    public async Task JsonTools_ExtractPath_StrictMode_RunAsync()
    {
        using var stream = Helpers.ToStream(@"{""Items"":[{""id"":1}]}");
        var result = await JsonTools.ExtractPath(stream, "Items")
            .StrictMode()
            .WithContent()
            .RunAsync();

        result.Objects.Should().HaveCount(1);
    }

    [Fact]
    public void JsonTools_BuildTrie_SearchWorks()
    {
        var items = new[] { "Tom Hanks", "Tom Cruise", "Morgan Freeman" };
        var trie = JsonTools.BuildTrie(items, s => s.ToLower().Split(' '));

        trie.Search("tom").Should().HaveCount(2);
        trie.Search("morgan").Should().ContainSingle();
        trie.Search("xyz").Should().BeEmpty();
    }

    [Fact]
    public void JsonTools_BuildTrie_ContainsExact()
    {
        var items = new[] { "javascript", "java", "python" };
        var trie = JsonTools.BuildTrie(items, s => new[] { s });

        trie.ContainsExact("javascript").Should().BeTrue();
        trie.ContainsExact("java").Should().BeTrue();
        trie.ContainsExact("jav").Should().BeFalse();
    }

    [Fact]
    public async Task JsonTools_BuildSemanticIndex_Stream_SearchWorks()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await JsonTools.BuildSemanticIndex(stream, new SemanticIndexOptions
        {
            IndexedFields = ["cast", "title"],
            CollectionPaths = ["shows"]
        });

        index.Count.Should().BeGreaterThan(0);
        var offsets = index.Search("hanks");
        offsets.Should().HaveCountGreaterThan(0, "Tom Hanks appears in 2 shows");
    }

    [Fact]
    public async Task JsonTools_BuildSemanticIndex_FilePath_SearchWorks()
    {
        var index = await JsonTools.BuildSemanticIndex(
            Helpers.FixturePath("catalog.json"),
            new SemanticIndexOptions
            {
                IndexedFields = ["title", "description"],
                CollectionPaths = ["shows"]
            });

        index.Count.Should().BeGreaterThan(0);
        var offsets = index.Search("crime");
        offsets.Should().HaveCountGreaterThan(0);
    }

    [Fact]
    public void JsonTools_CreateScanner_ReturnsInstance()
    {
        var scanner = JsonTools.CreateScanner();
        scanner.Should().NotBeNull();
        scanner.Should().BeOfType<GenericByteRangeScanner>();
    }

    [Fact]
    public void JsonTools_CreatePathScanner_ReturnsInstance()
    {
        var scanner = JsonTools.CreatePathScanner();
        scanner.Should().NotBeNull();
        scanner.Should().BeOfType<GenericJsonPathScanner>();
    }
}
