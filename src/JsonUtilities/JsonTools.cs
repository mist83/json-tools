using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using JsonUtilities.Fluent;
using JsonUtilities.Indexing;
using JsonUtilities.Models;

namespace JsonUtilities;

/// <summary>
/// The single entry point for all JsonUtilities operations.
/// Provides a fluent, discoverable API for JSON scanning, path extraction, trie indexing,
/// and semantic search index construction.
/// </summary>
/// <example>
/// <code>
/// // Byte-range scan
/// var result = await JsonTools.Scan(stream)
///     .ForCollections("products", "reviews")
///     .WithHashes()
///     .WithContent()
///     .RunAsync();
///
/// // Path extraction
/// var employees = await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
///     .WithContent()
///     .RunAsync();
///
/// // Trie index
/// var trie = JsonTools.BuildTrie(items, item => new[] { item.Title, item.Genre });
/// var matches = trie.Search("action");
///
/// // Semantic index (cast/description search)
/// var index = await JsonTools.BuildSemanticIndex(stream, new SemanticIndexOptions
/// {
///     IndexedFields = ["title", "cast", "description"],
///     IndexNGrams = true
/// });
/// var offsets = index.Search("hanks");
/// var objects = index.SearchObjects("hanks", filePath);
/// </code>
/// </example>
public static class JsonTools
{
    // ── Byte-Range Scanning ───────────────────────────────────────────────────

    /// <summary>
    /// Begins a fluent byte-range scan of the provided stream.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <returns>A <see cref="ScanBuilder"/> for configuring and executing the scan.</returns>
    public static ScanBuilder Scan(Stream stream) => new(stream);

    /// <summary>
    /// Begins a fluent byte-range scan of the specified file.
    /// </summary>
    /// <param name="filePath">Absolute or relative path to the JSON file.</param>
    /// <returns>A <see cref="ScanBuilder"/> for configuring and executing the scan.</returns>
    public static ScanBuilder Scan(string filePath)
    {
        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, useAsync: true);
        return new ScanBuilder(stream);
    }

    // ── Path Extraction ───────────────────────────────────────────────────────

    /// <summary>
    /// Begins a fluent dot-notation path scan of the provided stream.
    /// </summary>
    /// <param name="stream">A readable stream containing JSON content.</param>
    /// <param name="jsonPath">Dot-notation path to the target array (e.g. <c>company.departments.employees</c>).</param>
    /// <returns>A <see cref="PathScanBuilder"/> for configuring and executing the scan.</returns>
    public static PathScanBuilder ExtractPath(Stream stream, string jsonPath) => new(stream, jsonPath);

    /// <summary>
    /// Begins a fluent dot-notation path scan of the specified file.
    /// </summary>
    /// <param name="filePath">Absolute or relative path to the JSON file.</param>
    /// <param name="jsonPath">Dot-notation path to the target array.</param>
    /// <returns>A <see cref="PathScanBuilder"/> for configuring and executing the scan.</returns>
    public static PathScanBuilder ExtractPath(string filePath, string jsonPath)
    {
        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, useAsync: true);
        return new PathScanBuilder(stream, jsonPath);
    }

    // ── Trie Indexing ─────────────────────────────────────────────────────────

    /// <summary>
    /// Builds a <see cref="Trie{T}"/> from a collection of items using the provided word extractor.
    /// </summary>
    /// <typeparam name="T">The type of items to index. Must be a reference type.</typeparam>
    /// <param name="items">The collection of items to index.</param>
    /// <param name="wordExtractor">A function that returns an array of keywords for each item.</param>
    /// <param name="ensureUtf8Safety">When <c>true</c>, strips unsafe UTF-8 characters from keywords. Default: <c>true</c>.</param>
    /// <returns>A populated <see cref="Trie{T}"/> ready for prefix searches.</returns>
    public static Trie<T> BuildTrie<T>(IEnumerable<T> items, Func<T, string[]> wordExtractor, bool ensureUtf8Safety = true)
        where T : class
    {
        return new TrieBuilder<T>().Build(items, wordExtractor, ensureUtf8Safety);
    }

    // ── Semantic Index ────────────────────────────────────────────────────────

    /// <summary>
    /// Builds a <see cref="JsonIndex"/> from the provided stream by tokenizing configured fields.
    /// The index maps keywords to byte offsets for memory-efficient semantic search.
    /// </summary>
    /// <param name="stream">A readable, seekable stream containing JSON content.</param>
    /// <param name="options">Options controlling which fields to index and tokenization behavior.</param>
    /// <returns>A populated <see cref="JsonIndex"/> ready for prefix and phrase searches.</returns>
    public static Task<JsonIndex> BuildSemanticIndex(Stream stream, SemanticIndexOptions options)
        => new SemanticIndexBuilder(options).BuildAsync(stream);

    /// <summary>
    /// Builds a <see cref="JsonIndex"/> from the specified JSON file by tokenizing configured fields.
    /// </summary>
    /// <param name="filePath">Path to the JSON file to index.</param>
    /// <param name="options">Options controlling which fields to index and tokenization behavior.</param>
    /// <returns>A populated <see cref="JsonIndex"/> ready for prefix and phrase searches.</returns>
    public static Task<JsonIndex> BuildSemanticIndex(string filePath, SemanticIndexOptions options)
        => new SemanticIndexBuilder(options).BuildAsync(filePath);

    // ── Direct Scanner Access ─────────────────────────────────────────────────

    /// <summary>
    /// Creates a new <see cref="GenericByteRangeScanner"/> with default settings.
    /// Use when you need direct access to the scanner for advanced scenarios.
    /// </summary>
    public static GenericByteRangeScanner CreateScanner() => new();

    /// <summary>
    /// Creates a new <see cref="GenericJsonPathScanner"/> with default settings.
    /// Use when you need direct access to the path scanner for advanced scenarios.
    /// </summary>
    public static GenericJsonPathScanner CreatePathScanner() => new();
}
