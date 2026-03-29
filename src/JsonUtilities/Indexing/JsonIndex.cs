using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace JsonUtilities.Indexing;

/// <summary>
/// A memory-efficient semantic search index that maps keywords to byte offsets in a JSON source file.
/// Built by <see cref="SemanticIndexBuilder"/>, the index stores only positions — never content —
/// so memory growth tracks indexed terms and offsets rather than copied JSON objects.
/// </summary>
/// <remarks>
/// <para>
/// Internally uses a <c>Trie&lt;List&lt;long&gt;&gt;</c> where each terminal node holds a list of
/// byte offsets pointing back into the original JSON source. Searching returns offsets, which can
/// then be used for targeted byte-range reads to retrieve the actual JSON objects on demand.
/// </para>
/// <para>
/// Actual memory usage depends on indexed fields, token cardinality, and n-gram settings.
/// Use the benchmark harness in <c>docs/performance/README.md</c> to measure representative datasets.
/// </para>
/// </remarks>
public class JsonIndex
{
    private const byte ByteBackslash = (byte)'\\';
    private const byte ByteQuote = (byte)'"';
    private const byte ByteOpenBrace = (byte)'{';
    private const byte ByteCloseBrace = (byte)'}';
    private readonly Trie<OffsetList> _trie = new();
    private int _termCount;

    /// <summary>Gets the total number of keyword→offset pairs in the index.</summary>
    public int Count => _termCount;

    /// <summary>
    /// Adds a keyword→byte-offset mapping to the index.
    /// Multiple offsets can be associated with the same keyword (one per matching object).
    /// </summary>
    /// <param name="keyword">The keyword to index (should already be normalized/lowercased).</param>
    /// <param name="byteOffset">The byte offset of the JSON object containing this keyword.</param>
    internal void Add(string keyword, long byteOffset)
    {
        if (string.IsNullOrEmpty(keyword)) return;

        var list = _trie.GetOrAddExact(keyword, static () => new OffsetList());
        list.Offsets.Add(byteOffset);
        _termCount++;
    }

    /// <summary>
    /// Searches for all byte offsets associated with keywords that start with the given prefix.
    /// Returns distinct offsets (an object may match multiple keywords).
    /// </summary>
    /// <param name="prefix">The keyword prefix to search for (case-sensitive; normalize before calling).</param>
    /// <returns>An array of distinct byte offsets for all matching objects.</returns>
    public long[] Search(string prefix)
    {
        if (string.IsNullOrEmpty(prefix)) return Array.Empty<long>();

        var offsetLists = _trie.Search(prefix);
        var seen = new HashSet<long>();
        foreach (var list in offsetLists)
            foreach (var offset in list.Offsets)
                seen.Add(offset);

        var result = new long[seen.Count];
        seen.CopyTo(result);
        Array.Sort(result);
        return result;
    }

    /// <summary>
    /// Searches for matching objects and reads their JSON content from the provided stream.
    /// Objects are read lazily using targeted byte-range reads — the stream is never fully loaded.
    /// </summary>
    /// <param name="prefix">The keyword prefix to search for.</param>
    /// <param name="source">A seekable stream containing the original JSON source.</param>
    /// <param name="maxObjectSize">Maximum bytes to read per object. Default: 1 MB.</param>
    /// <returns>An enumerable of JSON object strings for all matching byte offsets.</returns>
    public IEnumerable<string> SearchObjects(string prefix, Stream source, int maxObjectSize = 1024 * 1024)
    {
        long[] offsets = Search(prefix);
        foreach (long offset in offsets)
        {
            source.Seek(offset, SeekOrigin.Begin);
            // Read until we find the matching closing brace
            var json = ReadJsonObject(source, maxObjectSize);
            if (json != null) yield return json;
        }
    }

    /// <summary>
    /// Searches for matching objects and reads their JSON content from a file.
    /// Uses a <see cref="FileStream"/> with <see cref="FileShare.Read"/> for safe concurrent access.
    /// </summary>
    /// <param name="prefix">The keyword prefix to search for.</param>
    /// <param name="filePath">Path to the original JSON source file.</param>
    /// <param name="maxObjectSize">Maximum bytes to read per object. Default: 1 MB.</param>
    /// <returns>An enumerable of JSON object strings for all matching byte offsets.</returns>
    public IEnumerable<string> SearchObjects(string prefix, string filePath, int maxObjectSize = 1024 * 1024)
    {
        long[] offsets = Search(prefix);
        if (offsets.Length == 0) yield break;

        using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536);
        foreach (long offset in offsets)
        {
            stream.Seek(offset, SeekOrigin.Begin);
            var json = ReadJsonObject(stream, maxObjectSize);
            if (json != null) yield return json;
        }
    }

    private static string? ReadJsonObject(Stream stream, int maxSize)
    {
        var buf = new byte[Math.Min(maxSize, 4096)];
        var objectBytes = new ArrayBufferWriter<byte>();
        int depth = 0;
        bool started = false;
        bool inString = false;
        bool escape = false;

        while (true)
        {
            int bytesRead = stream.Read(buf, 0, buf.Length);
            if (bytesRead == 0) break;

            int appendStart = 0;
            for (int i = 0; i < bytesRead; i++)
            {
                byte b = buf[i];

                if (escape)
                {
                    escape = false;
                }
                else if (b == ByteBackslash && inString)
                {
                    escape = true;
                }
                else if (b == ByteQuote)
                {
                    inString = !inString;
                }
                else if (!inString)
                {
                    if (b == ByteOpenBrace)
                    {
                        depth++;
                        started = true;
                    }
                    else if (b == ByteCloseBrace)
                    {
                        depth--;
                        if (started && depth == 0)
                        {
                            int segmentLength = i - appendStart + 1;
                            if (objectBytes.WrittenCount + segmentLength > maxSize)
                                return null;

                            objectBytes.Write(buf.AsSpan(appendStart, segmentLength));
                            return Encoding.UTF8.GetString(objectBytes.WrittenSpan);
                        }
                    }
                }
            }

            if (objectBytes.WrittenCount + (bytesRead - appendStart) > maxSize)
                return null;

            objectBytes.Write(buf.AsSpan(appendStart, bytesRead - appendStart));
        }

        return null;
    }

    /// <summary>Wrapper to hold a mutable list of byte offsets as a reference type for trie storage.</summary>
    internal sealed class OffsetList
    {
        public List<long> Offsets { get; } = new();
    }
}
