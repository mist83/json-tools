namespace JsonUtilities.Indexing;

public class NodeDataPointer<T> where T : class
{
    public string Keyword { get; set; } = string.Empty;
    public T? Datum { get; set; }
}
