namespace JsonUtilitiesDemo.Models;

public class SemanticSearchResponse
{
    public bool Success { get; set; }
    public ObjectInfo[] Objects { get; set; } = [];
    public long[] MatchedOffsets { get; set; } = [];
    public string[] IndexedFields { get; set; } = [];
    public string[] CollectionPaths { get; set; } = [];
    public SemanticSearchStats Stats { get; set; } = new();
    public string? Error { get; set; }
}
