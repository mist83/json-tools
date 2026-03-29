using BenchmarkDotNet.Attributes;

namespace JsonUtilities.Benchmarks;

[MemoryDiagnoser]
[MarkdownExporter]
[ShortRunJob]
public class ByteRangeBenchmarks
{
    private string _filePath = string.Empty;

    [Params(1_000, 10_000)]
    public int ItemCount { get; set; }

    [GlobalSetup]
    public void Setup()
    {
        _filePath = BenchmarkDataFactory.EnsureCatalogFile(ItemCount);
    }

    [Benchmark(Baseline = true)]
    public async Task<int> ScanAndCollectRanges()
    {
        await using var stream = File.OpenRead(_filePath);
        var result = await JsonTools.Scan(stream)
            .ForCollections("items")
            .SkipValidation()
            .RunAsync();

        return result.Metadata.TotalObjectsFound;
    }

    [Benchmark]
    public async Task<int> ScanIncrementally()
    {
        await using var stream = File.OpenRead(_filePath);
        var count = 0;

        await JsonTools.Scan(stream)
            .ForCollections("items")
            .SkipValidation()
            .ProcessAsync((_, _) => count++);

        return count;
    }

    [Benchmark]
    public async Task<int> ScanIncrementallyWithHashes()
    {
        await using var stream = File.OpenRead(_filePath);
        var count = 0;

        await JsonTools.Scan(stream)
            .ForCollections("items")
            .WithHashes()
            .SkipValidation()
            .ProcessAsync((_, _) => count++);

        return count;
    }
}
