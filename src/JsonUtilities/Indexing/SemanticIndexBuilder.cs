using System;
using System.Buffers;
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
    private readonly HashSet<string>? _indexedFieldsLookup;
    private readonly SearchValues<char> _wordSeparators;

    /// <summary>
    /// Initializes a new <see cref="SemanticIndexBuilder"/> with the specified options.
    /// </summary>
    /// <param name="options">Configuration controlling which fields to index and how to tokenize them.</param>
    public SemanticIndexBuilder(SemanticIndexOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _wordSeparators = SearchValues.Create(_options.WordSeparators);
        if (_options.IndexedFields.Length > 0)
            _indexedFieldsLookup = new HashSet<string>(_options.IndexedFields, StringComparer.OrdinalIgnoreCase);
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
            IncludeJsonContent = false,
            CalculateHashes = false,
            ValidateUtf8 = false,
            SkipStructureValidation = true,
            ContinueOnError = true
        };

        await scanner.ProcessBufferedStreamAsync(stream, (_, obj) =>
        {
            if (obj.Bytes.IsEmpty) return;
            IndexObject(obj.StartPosition, obj.Bytes, index);
        }, scanOptions);

        return index;
    }

    private void IndexObject(long byteOffset, ReadOnlyMemory<byte> jsonBytes, JsonIndex index)
    {
        try
        {
            using var doc = JsonDocument.Parse(jsonBytes);
            var root = doc.RootElement;

            if (root.ValueKind != JsonValueKind.Object) return;

            foreach (var prop in root.EnumerateObject())
            {
                if (_indexedFieldsLookup != null && !_indexedFieldsLookup.Contains(prop.Name))
                    continue;

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
        List<string>? validWords = _options.IndexNGrams ? [] : null;

        int i = 0;
        while (i < text.Length)
        {
            ReadOnlySpan<char> remaining = text.AsSpan(i);
            int tokenOffset = remaining.IndexOfAnyExcept(_wordSeparators);
            if (tokenOffset < 0)
                break;

            i += tokenOffset;
            remaining = text.AsSpan(i);

            int length = remaining.IndexOfAny(_wordSeparators);
            if (length < 0)
                length = remaining.Length;

            if (length < _options.MinWordLength)
            {
                i += length;
                continue;
            }

            string keyword = CreateKeyword(text, i, length);
            index.Add(keyword, byteOffset);
            validWords?.Add(keyword);

            i += length;
        }

        // N-gram indexing for phrase search
        if (validWords is { Count: > 1 })
        {
            var builder = new StringBuilder();
            for (int n = 2; n <= Math.Min(_options.MaxNGramLength, validWords.Count); n++)
            {
                for (int start = 0; start <= validWords.Count - n; start++)
                {
                    builder.Clear();
                    builder.Append(validWords[start]);
                    for (int j = 1; j < n; j++)
                    {
                        builder.Append(' ');
                        builder.Append(validWords[start + j]);
                    }

                    index.Add(builder.ToString(), byteOffset);
                }
            }
        }
    }

    private string CreateKeyword(string text, int start, int length)
    {
        if (_options.CaseSensitive)
            return text.Substring(start, length);

        return string.Create(length, (text, start), static (span, state) =>
        {
            for (int i = 0; i < span.Length; i++)
                span[i] = char.ToLowerInvariant(state.text[state.start + i]);
        });
    }
}
