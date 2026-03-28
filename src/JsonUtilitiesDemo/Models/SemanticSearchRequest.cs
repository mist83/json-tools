namespace JsonUtilitiesDemo.Models;

public class SemanticSearchRequest
{
    public string JsonContent { get; set; } = string.Empty;
    public string SearchTerm { get; set; } = string.Empty;
    public string[] IndexedFields { get; set; } = [];
    public string[] CollectionPaths { get; set; } = [];
    public bool IndexNGrams { get; set; } = true;
    public int MaxResults { get; set; } = 10;
}
