namespace JsonUtilities;

public interface IJsonValidator
{
    bool IsValidUtf8JsonDelimiter(byte[] bytes, int position);
    void ValidateUtf8Safety(string json);
    bool IsValidJsonStructure(string json);
    bool ValidateUtf8DelimiterSafety(byte[] testBytes);
}
