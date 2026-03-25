using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using JsonUtilities.Indexing;
using Xunit;

namespace JsonUtilities.Tests;

public class SemanticIndexTests
{
    private static readonly string CatalogPath = Helpers.FixturePath("catalog.json");

    [Fact]
    public async Task SemanticIndex_BuildFromStream_IndexesConfiguredFields()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var builder = new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["title", "cast"],
            CollectionPaths = ["shows"]
        });

        var index = await builder.BuildAsync(stream);
        index.Count.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SemanticIndex_BuildFromFilePath_Works()
    {
        var builder = new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["title"],
            CollectionPaths = ["shows"]
        });

        var index = await builder.BuildAsync(CatalogPath);
        index.Count.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SemanticIndex_Search_CastMember_ReturnsCorrectOffsets()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"]
        }).BuildAsync(stream);

        // Tom Hanks appears in Forrest Gump and Cast Away
        var offsets = index.Search("hanks");
        offsets.Should().HaveCount(2, "Tom Hanks is in 2 shows");
    }

    [Fact]
    public async Task SemanticIndex_Search_Prefix_ReturnsAllMatches()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"]
        }).BuildAsync(stream);

        // "tom" should match "Tom Hanks", "Tom Robbins" etc.
        var offsets = index.Search("tom");
        offsets.Should().HaveCountGreaterThan(0);
    }

    [Fact]
    public async Task SemanticIndex_Search_NoMatch_ReturnsEmpty()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["title"],
            CollectionPaths = ["shows"]
        }).BuildAsync(stream);

        index.Search("xyznonexistent").Should().BeEmpty();
    }

    [Fact]
    public async Task SemanticIndex_SearchObjects_ReturnsValidJsonStrings()
    {
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"]
        }).BuildAsync(CatalogPath);

        var objects = index.SearchObjects("hanks", CatalogPath).ToList();
        objects.Should().HaveCount(2);
        foreach (var json in objects)
        {
            new JsonValidator().IsValidJsonStructure(json).Should().BeTrue();
            json.Should().Contain("Tom Hanks");
        }
    }

    [Fact]
    public async Task SemanticIndex_SearchObjects_Stream_ReturnsValidJsonStrings()
    {
        using var buildStream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"]
        }).BuildAsync(buildStream);

        using var searchStream = Helpers.LoadFixture("catalog.json");
        var objects = index.SearchObjects("freeman", searchStream).ToList();
        objects.Should().HaveCountGreaterThan(0);
        objects.First().Should().Contain("Morgan Freeman");
    }

    [Fact]
    public async Task SemanticIndex_NGrams_EnabledAndSearchable()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"],
            IndexNGrams = true,
            MaxNGramLength = 2
        }).BuildAsync(stream);

        // "tom hanks" as a bigram
        var offsets = index.Search("tom hanks");
        offsets.Should().HaveCount(2, "Tom Hanks bigram should match 2 shows");
    }

    [Fact]
    public async Task SemanticIndex_MinWordLength_FiltersShortWords()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["title"],
            CollectionPaths = ["shows"],
            MinWordLength = 4
        }).BuildAsync(stream);

        // "The" (3 chars) should not be indexed
        index.Search("the").Should().BeEmpty("'the' is 3 chars, below MinWordLength=4");
        // "Dark" (4 chars) should be indexed
        index.Search("dark").Should().HaveCountGreaterThan(0);
    }

    [Fact]
    public async Task SemanticIndex_AllFields_WhenIndexedFieldsEmpty()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = [], // empty = index all string fields
            CollectionPaths = ["shows"]
        }).BuildAsync(stream);

        // Should index everything including genres, descriptions, etc.
        index.Count.Should().BeGreaterThan(50);
    }

    [Fact]
    public async Task SemanticIndex_DistinctOffsets_PerKeyword()
    {
        using var stream = Helpers.LoadFixture("catalog.json");
        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["cast"],
            CollectionPaths = ["shows"]
        }).BuildAsync(stream);

        var offsets = index.Search("hanks");
        // Offsets should be distinct (no duplicates)
        offsets.Should().OnlyHaveUniqueItems();
        offsets.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task SemanticIndex_LargeDataset_MemoryStaysReasonable()
    {
        using var stream = Helpers.LoadFixture("large_collection.json");
        var before = System.GC.GetTotalMemory(forceFullCollection: true);

        var index = await new SemanticIndexBuilder(new SemanticIndexOptions
        {
            IndexedFields = ["name", "category"],
            CollectionPaths = ["items"]
        }).BuildAsync(stream);

        var after = System.GC.GetTotalMemory(forceFullCollection: false);
        var deltaKb = (after - before) / 1024;

        index.Count.Should().BeGreaterThan(0);
        // 1000 items with name+category should not use more than 10MB
        deltaKb.Should().BeLessThan(10 * 1024, "index should be memory-efficient");
    }
}
