using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace JsonUtilities.Indexing;

/// <summary>
/// A generic prefix-tree (Trie) for O(prefix_length) keyword lookups.
/// Supports any reference type as the stored datum, making it suitable for
/// both string-based search indexes and byte-offset semantic indexes.
/// </summary>
/// <typeparam name="T">The type of data stored at terminal nodes. Must be a reference type.</typeparam>
public class Trie<T> where T : class
{
    private readonly Node<T> _root = new('^', null, 0);

    private Node<T> Prefix(ReadOnlySpan<char> s)
    {
        Node<T> node = _root;
        Node<T> result = _root;
        foreach (char c in s)
        {
            var child = node.FindChildNode(c);
            if (child == null) break;
            result = child;
            node = child;
        }
        return result;
    }

    /// <summary>
    /// Returns all data items whose keyword starts with <paramref name="searchText"/>.
    /// Performs a breadth-first traversal from the prefix node to collect all terminal descendants.
    /// </summary>
    /// <param name="searchText">The prefix to search for. Case-sensitive.</param>
    /// <returns>An array of all matching data items, or an empty array if no matches found.</returns>
    public T[] Search(string searchText)
    {
        if (string.IsNullOrEmpty(searchText)) return Array.Empty<T>();

        Node<T> node = Prefix(searchText.AsSpan());
        if (node.Depth != searchText.Length) return Array.Empty<T>();

        var results = new List<T>();
        var queue = new Queue<Node<T>>();

        if (node.Children != null)
            foreach (var child in node.Children)
                queue.Enqueue(child);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current.Data != null) results.Add(current.Data);
            if (current.Children != null)
                foreach (var child in current.Children)
                    queue.Enqueue(child);
        }

        return results.ToArray();
    }

    /// <summary>
    /// Determines whether the trie contains an exact match for the specified keyword.
    /// More efficient than <see cref="Search"/> when you only need existence checking.
    /// </summary>
    /// <param name="keyword">The exact keyword to look up.</param>
    /// <returns><c>true</c> if the keyword exists in the trie; <c>false</c> otherwise.</returns>
    public bool ContainsExact(string keyword)
    {
        if (string.IsNullOrEmpty(keyword)) return false;
        Node<T> node = Prefix(keyword.AsSpan());
        if (node.Depth != keyword.Length) return false;
        // Check for a terminal '$' child
        if (node.Children == null) return false;
        foreach (var child in node.Children)
            if (child.Value == '$') return true;
        return false;
    }

    /// <summary>
    /// Inserts a keyword→datum mapping into the trie.
    /// If the keyword already exists, an additional terminal node is added (duplicates are allowed).
    /// </summary>
    /// <param name="data">The <see cref="NodeDataPointer{T}"/> containing the keyword and datum to insert.</param>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public void Insert(NodeDataPointer<T> data)
    {
        if (string.IsNullOrEmpty(data.Keyword)) return;

        Node<T> node = Prefix(data.Keyword.AsSpan());
        for (int i = node.Depth; i < data.Keyword.Length; i++)
        {
            var newNode = new Node<T>(data.Keyword[i], null, node.Depth + 1);
            node.Children ??= new List<Node<T>>();
            node.Children.Add(newNode);
            node = newNode;
        }

        node.Children ??= new List<Node<T>>();
        node.Children.Add(new Node<T>('$', data.Datum, node.Depth + 1));
    }

    /// <summary>
    /// Returns the datum for an exact keyword match, or creates and inserts one when absent.
    /// Unlike <see cref="Search"/>, this does not traverse descendant prefixes.
    /// </summary>
    /// <param name="keyword">The exact keyword to resolve.</param>
    /// <param name="factory">Factory used to create the datum when the keyword is not present.</param>
    /// <returns>The existing or newly created datum for the exact keyword.</returns>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    internal T GetOrAddExact(string keyword, Func<T> factory)
    {
        ArgumentException.ThrowIfNullOrEmpty(keyword);
        ArgumentNullException.ThrowIfNull(factory);

        Node<T> node = Prefix(keyword.AsSpan());
        for (int i = node.Depth; i < keyword.Length; i++)
        {
            var newNode = new Node<T>(keyword[i], null, node.Depth + 1);
            node.Children ??= new List<Node<T>>();
            node.Children.Add(newNode);
            node = newNode;
        }

        node.Children ??= new List<Node<T>>();
        foreach (var child in node.Children)
        {
            if (child.Value == '$' && child.Data != null)
                return child.Data;
        }

        var datum = factory();
        node.Children.Add(new Node<T>('$', datum, node.Depth + 1));
        return datum;
    }

    /// <summary>
    /// Returns the total number of terminal nodes (i.e. the number of inserted keyword→datum pairs).
    /// </summary>
    /// <returns>The count of all terminal nodes in the trie.</returns>
    public int Count()
    {
        int count = 0;
        var stack = new Stack<Node<T>>();
        stack.Push(_root);
        while (stack.Count > 0)
        {
            var node = stack.Pop();
            if (node.Value == '$') count++;
            if (node.Children != null)
                foreach (var child in node.Children)
                    stack.Push(child);
        }
        return count;
    }
}
