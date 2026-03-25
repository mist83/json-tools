using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace JsonUtilities.Indexing;

/// <summary>
/// Generic prefix-tree (Trie) for fast prefix-based lookups.
/// Supports any reference type as the stored datum.
/// </summary>
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
    /// Search for all data items whose keyword starts with <paramref name="searchText"/>.
    /// </summary>
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
    /// Insert a keyword→datum mapping into the trie.
    /// </summary>
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
    /// Returns the total number of terminal nodes (indexed terms).
    /// </summary>
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
