using BenchmarkDotNet.Attributes;
using JsonUtilities.Indexing;

namespace JsonUtilities.Benchmarks;

[MemoryDiagnoser]
[MarkdownExporter]
[ShortRunJob]
public class SemanticBenchmarks
{
    private string _filePath = string.Empty;
    private JsonIndex _index = null!;

    [Params(1_000, 10_000)]
    public int ItemCount { get; set; }

    [GlobalSetup(Targets = [nameof(BuildIndex)])]
    public void SetupBuild()
    {
        _filePath = BenchmarkDataFactory.EnsureCatalogFile(ItemCount);
    }

    [GlobalSetup(Targets = [nameof(SearchOffsets), nameof(SearchObjects)])]
    public async Task SetupSearch()
    {
        _filePath = BenchmarkDataFactory.EnsureCatalogFile(ItemCount);
        _index = await JsonTools.BuildSemanticIndex(_filePath, new SemanticIndexOptions
        {
            IndexedFields = ["name", "category", "description", "tags"],
            CollectionPaths = ["items"],
            IndexNGrams = true
        });
    }

    [Benchmark]
    public Task<JsonIndex> BuildIndex()
    {
        return JsonTools.BuildSemanticIndex(_filePath, new SemanticIndexOptions
        {
            IndexedFields = ["name", "category", "description", "tags"],
            CollectionPaths = ["items"],
            IndexNGrams = true
        });
    }

    [Benchmark]
    public long[] SearchOffsets()
    {
        return _index.Search("stream");
    }

    [Benchmark]
    public int SearchObjects()
    {
        return _index.SearchObjects("stream", _filePath).Count();
    }
}
