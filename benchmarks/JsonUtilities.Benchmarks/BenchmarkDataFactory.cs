using System.Text;

namespace JsonUtilities.Benchmarks;

internal static class BenchmarkDataFactory
{
    public static string EnsureCatalogFile(int itemCount)
    {
        var dir = Path.Combine(Path.GetTempPath(), "json-utilities-benchmarks");
        Directory.CreateDirectory(dir);

        var path = Path.Combine(dir, $"catalog-{itemCount}.json");
        if (!File.Exists(path))
            File.WriteAllText(path, CreateCatalogJson(itemCount), Encoding.UTF8);

        return path;
    }

    private static string CreateCatalogJson(int itemCount)
    {
        var sb = new StringBuilder(itemCount * 256);
        sb.Append("{\"items\":[");

        for (int i = 0; i < itemCount; i++)
        {
            if (i > 0) sb.Append(',');

            sb.Append("{\"id\":").Append(i + 1)
                .Append(",\"name\":\"Item ").Append(i + 1)
                .Append("\",\"category\":\"").Append(GetCategory(i))
                .Append("\",\"description\":\"").Append(GetDescription(i))
                .Append("\",\"tags\":[\"").Append(GetTag(i, 0))
                .Append("\",\"").Append(GetTag(i, 1))
                .Append("\",\"").Append(GetTag(i, 2))
                .Append("\"],\"rating\":").Append((i % 5) + 1)
                .Append(",\"featured\":").Append(i % 7 == 0 ? "true" : "false")
                .Append('}');
        }

        sb.Append("]}");
        return sb.ToString();
    }

    private static string GetCategory(int index) => (index % 5) switch
    {
        0 => "analytics",
        1 => "streaming",
        2 => "security",
        3 => "archival",
        _ => "catalog"
    };

    private static string GetDescription(int index)
    {
        return (index % 4) switch
        {
            0 => "Fast byte range scan with low allocation overhead and deterministic offsets.",
            1 => "Semantic catalog entry for privacy friendly local search and indexing workflows.",
            2 => "Streaming friendly record intended for benchmark coverage and large file iteration.",
            _ => "Reference object for measuring hashing, validation, and callback based processing."
        };
    }

    private static string GetTag(int index, int offset)
    {
        string[] tags = ["privacy", "json", "search", "offsets", "stream", "lambda", "wasm", "catalog"];
        return tags[(index + offset) % tags.Length];
    }
}
