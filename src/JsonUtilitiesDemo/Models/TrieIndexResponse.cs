namespace JsonUtilitiesDemo.Models;

public class TrieIndexResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string[] Matches { get; set; } = [];
    public int TotalIndexed { get; set; }
}
