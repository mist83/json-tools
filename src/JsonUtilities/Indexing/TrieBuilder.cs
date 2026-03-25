using System;
using System.Collections.Generic;
using System.Text;

namespace JsonUtilities.Indexing;

/// <summary>
/// Builds a <see cref="Trie{T}"/> from a collection of items using a configurable word-extraction function.
/// Handles UTF-8 safety normalization to prevent encoding issues in the trie.
/// </summary>
/// <typeparam name="T">The type of items to index. Must be a reference type.</typeparam>
public class TrieBuilder<T> where T : class
{
    private readonly Encoding _utf8Encoder = Encoding.GetEncoding(
        "UTF-8",
        new EncoderReplacementFallback(string.Empty),
        new DecoderExceptionFallback());

    /// <summary>
    /// Builds a trie by extracting keywords from each item using the provided word extractor.
    /// Each item is associated with all of its extracted keywords.
    /// </summary>
    /// <param name="items">The collection of items to index.</param>
    /// <param name="wordExtractor">A function that returns an array of keywords for a given item.</param>
    /// <param name="ensureUtf8Safety">When <c>true</c>, strips unsafe UTF-8 characters from keywords. Default: <c>true</c>.</param>
    /// <returns>A populated <see cref="Trie{T}"/> ready for prefix searches.</returns>
    public Trie<T> Build(IEnumerable<T> items, Func<T, string[]> wordExtractor, bool ensureUtf8Safety = true)
    {
        var trie = new Trie<T>();
        foreach (T item in items)
        {
            foreach (string keyword in wordExtractor(item))
            {
                trie.Insert(new NodeDataPointer<T>
                {
                    Keyword = ensureUtf8Safety ? EnsureUtf8Safe(keyword) : keyword,
                    Datum = item
                });
            }
        }
        return trie;
    }

    /// <summary>
    /// Builds a trie using a word extractor that returns both keywords and a custom datum per item.
    /// Use this overload when the datum to store differs from the source item (e.g. storing an ID instead of the full object).
    /// </summary>
    /// <param name="items">The collection of items to index.</param>
    /// <param name="wordExtractor">A function that returns a tuple of (keywords, datum) for a given item.</param>
    /// <param name="ensureUtf8Safety">When <c>true</c>, strips unsafe UTF-8 characters from keywords. Default: <c>true</c>.</param>
    /// <returns>A populated <see cref="Trie{T}"/> ready for prefix searches.</returns>
    public Trie<T> Build(IEnumerable<T> items, Func<T, (string[] words, T datum)> wordExtractor, bool ensureUtf8Safety = true)
    {
        var trie = new Trie<T>();
        foreach (T item in items)
        {
            var (words, datum) = wordExtractor(item);
            foreach (string word in words)
            {
                trie.Insert(new NodeDataPointer<T>
                {
                    Keyword = ensureUtf8Safety ? EnsureUtf8Safe(word) : word,
                    Datum = datum
                });
            }
        }
        return trie;
    }

    private string EnsureUtf8Safe(string input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        return _utf8Encoder.GetString(_utf8Encoder.GetBytes(input));
    }
}
