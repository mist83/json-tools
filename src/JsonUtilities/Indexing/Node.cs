using System.Collections.Generic;

namespace JsonUtilities.Indexing;

/// <summary>
/// A single node in a <see cref="Trie{T}"/> prefix tree.
/// Each node represents one character in a keyword path from root to leaf.
/// </summary>
/// <typeparam name="T">The type of data stored at terminal nodes.</typeparam>
public class Node<T> where T : class
{
    /// <summary>Gets the character value this node represents in the trie path.</summary>
    public char Value { get; }

    /// <summary>Gets or sets the datum stored at this node. Non-null only at terminal (<c>$</c>) nodes.</summary>
    public T? Data { get; set; }

    /// <summary>Gets the depth of this node from the root (root = 0).</summary>
    public int Depth { get; }

    /// <summary>Gets or sets the child nodes of this node. <c>null</c> when this is a leaf.</summary>
    public List<Node<T>>? Children { get; set; }

    /// <summary>
    /// Initializes a new <see cref="Node{T}"/> with the specified character, data, and depth.
    /// </summary>
    /// <param name="value">The character this node represents.</param>
    /// <param name="data">Optional datum to store at this node.</param>
    /// <param name="depth">The depth of this node from the root.</param>
    public Node(char value, T? data, int depth)
    {
        Value = value;
        Data = data;
        Depth = depth;
    }

    /// <summary>
    /// Finds the direct child node matching the specified character, or <c>null</c> if not found.
    /// </summary>
    /// <param name="c">The character to search for among children.</param>
    /// <returns>The matching child node, or <c>null</c>.</returns>
    public Node<T>? FindChildNode(char c)
    {
        if (Children == null) return null;
        foreach (var child in Children)
            if (child.Value == c) return child;
        return null;
    }
}
