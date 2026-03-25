using System.Collections.Generic;

namespace JsonUtilities.Models;

public class JsonObjectRange
{
    public long StartPosition { get; set; }
    public long Length { get; set; }
    public string? ObjectType { get; set; }
    public string? Hash { get; set; }
    public Dictionary<string, object>? Properties { get; set; }
    public string? JsonContent { get; set; }
    public int ItemIndex { get; set; }
    public string? Error { get; set; }
    public long EndPosition => StartPosition + Length;
}
