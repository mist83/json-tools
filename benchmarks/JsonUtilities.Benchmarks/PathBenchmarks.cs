using BenchmarkDotNet.Attributes;
using JsonUtilities.Models;

namespace JsonUtilities.Benchmarks;

[MemoryDiagnoser]
[MarkdownExporter]
[ShortRunJob]
public class PathBenchmarks
{
    private string _filePath = string.Empty;

    [Params(1_000, 10_000)]
    public int ItemCount { get; set; }

    [GlobalSetup]
    public void Setup()
    {
        _filePath = BenchmarkDataFactory.EnsureNestedCatalogFile(ItemCount);
    }

    [Benchmark(Baseline = true)]
    public async Task<int> ScanPathAndCollect()
    {
        await using var stream = File.OpenRead(_filePath);
        var result = await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
            .SkipValidation()
            .RunAsync();

        return result.Metadata.TotalObjectsFound;
    }

    [Benchmark]
    public async Task<int> ProcessPathIncrementally()
    {
        await using var stream = File.OpenRead(_filePath);
        var count = 0;

        await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
            .SkipValidation()
            .ProcessAsync(_ => count++);

        return count;
    }

    [Benchmark]
    public async Task<int> ProcessPathIncrementallyWithHashes()
    {
        await using var stream = File.OpenRead(_filePath);
        var count = 0;
        var scanner = new GenericJsonPathScanner();

        await scanner.ProcessStreamAsync(stream, "company.departments.engineering.employees",
            _ => count++,
            new JsonPathScanOptions
            {
                IncludeJsonContent = false,
                CalculateHashes = true,
                SkipStructureValidation = true
            });

        return count;
    }
}
