using System.Collections.Generic;

namespace JsonUtilities.Indexing;

public class Node<T> where T : class
{
    public char Value { get; }
    public T? Data { get; set; }
    public int Depth { get; }
    public List<Node<T>>? Children { get; set; }

    public Node(char value, T? data, int depth)
    {
        Value = value;
        Data = data;
        Depth = depth;
    }

    public Node<T>? FindChildNode(char c)
    {
        if (Children == null) return null;
        foreach (var child in Children)
            if (child.Value == c) return child;
        return null;
    }
}
