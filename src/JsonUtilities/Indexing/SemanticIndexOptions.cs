namespace JsonUtilities.Indexing;

/// <summary>
/// Configuration options for building a <see cref="JsonIndex"/> via <see cref="SemanticIndexBuilder"/>.
/// Controls which JSON fields are tokenized, how words are extracted, and whether n-gram indexing is enabled.
/// </summary>
public class SemanticIndexOptions
{
    /// <summary>
    /// Gets or sets the JSON field names whose values will be tokenized and indexed.
    /// For example: <c>["title", "cast", "description", "tags"]</c>.
    /// Field matching is case-insensitive.
    /// </summary>
    public string[] IndexedFields { get; set; } = [];

    /// <summary>
    /// Gets or sets the dot-notation collection paths to scan for objects.
    /// For example: <c>["shows", "movies"]</c> or <c>["catalog.items"]</c>.
    /// When empty, the scanner auto-detects common collection names.
    /// </summary>
    public string[] CollectionPaths { get; set; } = [];

    /// <summary>
    /// Gets or sets a value indicating whether keyword matching is case-sensitive.
    /// Default: <c>false</c> (all keywords are lowercased before indexing).
    /// </summary>
    public bool CaseSensitive { get; set; } = false;

    /// <summary>
    /// Gets or sets the minimum word length to index. Words shorter than this are skipped.
    /// Default: <c>2</c>.
    /// </summary>
    public int MinWordLength { get; set; } = 2;

    /// <summary>
    /// Gets or sets a value indicating whether to index n-gram phrases (consecutive word pairs)
    /// in addition to individual words. Enables proximity-style search (e.g. "tom hanks" as a phrase).
    /// Default: <c>false</c>.
    /// </summary>
    public bool IndexNGrams { get; set; } = false;

    /// <summary>
    /// Gets or sets the maximum n-gram length (number of words per phrase) when <see cref="IndexNGrams"/> is enabled.
    /// Default: <c>2</c> (bigrams only).
    /// </summary>
    public int MaxNGramLength { get; set; } = 2;

    /// <summary>
    /// Gets or sets the characters used to split field values into individual words.
    /// Default: space, comma, period, semicolon, colon, hyphen, underscore, slash, parentheses.
    /// </summary>
    public char[] WordSeparators { get; set; } = [' ', ',', '.', ';', ':', '-', '_', '/', '(', ')'];
}
