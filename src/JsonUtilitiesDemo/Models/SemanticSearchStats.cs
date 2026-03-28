namespace JsonUtilitiesDemo.Models;

public class SemanticSearchStats
{
    public long BytesProcessed { get; set; }
    public int ObjectsIndexed { get; set; }
    public int MatchesFound { get; set; }
    public int CollectionsScanned { get; set; }
    public int TermsIndexed { get; set; }
    public double ProcessingTimeMs { get; set; }
}
