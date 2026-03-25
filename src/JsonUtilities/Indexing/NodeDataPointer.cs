namespace JsonUtilities.Indexing;

/// <summary>
/// Associates a keyword string with a datum value for insertion into a <see cref="Trie{T}"/>.
/// </summary>
/// <typeparam name="T">The type of the associated datum.</typeparam>
public class NodeDataPointer<T> where T : class
{
    /// <summary>Gets or sets the keyword string used as the trie key.</summary>
    public string Keyword { get; set; } = string.Empty;

    /// <summary>Gets or sets the datum value associated with this keyword.</summary>
    public T? Datum { get; set; }
}
