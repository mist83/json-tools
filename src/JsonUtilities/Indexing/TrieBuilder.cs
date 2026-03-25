using System;
using System.Collections.Generic;
using System.Text;

namespace JsonUtilities.Indexing;

/// <summary>
/// Builds a Trie from a collection of items using a word-extraction function.
/// Handles UTF-8 safety normalization.
/// </summary>
public class TrieBuilder<T> where T : class
{
    private readonly Encoding _utf8Encoder = Encoding.GetEncoding(
        "UTF-8",
        new EncoderReplacementFallback(string.Empty),
        new DecoderExceptionFallback());

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
