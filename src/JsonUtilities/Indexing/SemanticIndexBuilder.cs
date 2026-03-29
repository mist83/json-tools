using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using JsonUtilities.Models;

namespace JsonUtilities.Indexing;

/// <summary>
/// Builds a <see cref="JsonIndex"/> from a JSON stream by scanning objects and tokenizing
/// the values of configured fields into searchable keywords.
/// </summary>
/// <remarks>
/// <para>
/// The builder uses <see cref="JsonUtilities.GenericByteRangeScanner"/> to locate objects and
/// processes them incrementally through the scanner's streaming callback path. Each object's
/// configured fields are parsed with <see cref="System.Text.Json.JsonDocument"/> and tokenized
/// immediately; only byte offsets are retained in the final index.
/// </para>
/// <para>
/// Actual build cost depends on field selection, token cardinality, and n-gram settings.
/// Use the benchmark harness in <c>docs/performance/README.md</c> to measure representative workloads.
/// </para>
/// </remarks>
public class SemanticIndexBuilder
{
    private readonly SemanticIndexOptions _options;

    /// <summary>
    /// Initializes a new <see cref="SemanticIndexBuilder"/> with the specified options.
    /// </summary>
    /// <param name="options">Configuration controlling which fields to index and how to tokenize them.</param>
    public SemanticIndexBuilder(SemanticIndexOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
    }

    /// <summary>
    /// Builds a <see cref="JsonIndex"/> by scanning the specified JSON file.
    /// </summary>
    /// <param name="filePath">Path to the JSON file to index.</param>
    /// <returns>A populated <see cref="JsonIndex"/> ready for prefix searches.</returns>
    public async Task<JsonIndex> BuildAsync(string filePath)
    {
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, useAsync: true);
        return await BuildAsync(stream);
    }

    /// <summary>
    /// Builds a <see cref="JsonIndex"/> by scanning the provided JSON stream.
    /// </summary>
    /// <param name="stream">A readable, seekable stream containing JSON content.</param>
    /// <returns>A populated <see cref="JsonIndex"/> ready for prefix searches.</returns>
    public async Task<JsonIndex> BuildAsync(Stream stream)
    {
        var index = new JsonIndex();
        var scanner = new GenericByteRangeScanner();

        var scanOptions = new JsonScanOptions
        {
            TargetCollections = _options.CollectionPaths.Length > 0 ? _options.CollectionPaths : null,
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false,
            SkipStructureValidation = true,
            ContinueOnError = true
        };

        await scanner.ProcessStreamAsync(stream, (_, obj) =>
        {
            if (obj.JsonContent == null) return;
            IndexObject(obj.StartPosition, obj.JsonContent, index);
        }, scanOptions);

        return index;
    }

    private void IndexObject(long byteOffset, string jsonText, JsonIndex index)
    {
        try
        {
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            if (root.ValueKind != JsonValueKind.Object) return;

            foreach (var prop in root.EnumerateObject())
            {
                // Check if this field is in our indexed fields list (case-insensitive)
                bool shouldIndex = _options.IndexedFields.Length == 0;
                if (!shouldIndex)
                {
                    foreach (var field in _options.IndexedFields)
                    {
                        if (string.Equals(prop.Name, field, StringComparison.OrdinalIgnoreCase))
                        {
                            shouldIndex = true;
                            break;
                        }
                    }
                }

                if (!shouldIndex) continue;

                IndexElement(prop.Value, byteOffset, index);
            }
        }
        catch (JsonException)
        {
            // Skip malformed objects silently
        }
    }

    private void IndexElement(JsonElement element, long byteOffset, JsonIndex index)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.String:
                var str = element.GetString();
                if (!string.IsNullOrWhiteSpace(str))
                    IndexText(str, byteOffset, index);
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    IndexElement(item, byteOffset, index);
                break;

            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject())
                    IndexElement(prop.Value, byteOffset, index);
                break;
        }
    }

    private void IndexText(string text, long byteOffset, JsonIndex index)
    {
        var words = text.Split(_options.WordSeparators, StringSplitOptions.RemoveEmptyEntries);
        var validWords = new List<string>(words.Length);

        foreach (var word in words)
        {
            if (word.Length < _options.MinWordLength) continue;
            string keyword = _options.CaseSensitive ? word : word.ToLowerInvariant();
            index.Add(keyword, byteOffset);
            validWords.Add(keyword);
        }

        // N-gram indexing for phrase search
        if (_options.IndexNGrams && validWords.Count > 1)
        {
            for (int n = 2; n <= Math.Min(_options.MaxNGramLength, validWords.Count); n++)
            {
                for (int i = 0; i <= validWords.Count - n; i++)
                {
                    var ngram = string.Join(" ", validWords.GetRange(i, n));
                    index.Add(ngram, byteOffset);
                }
            }
        }
    }
}
