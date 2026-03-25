using System;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace JsonUtilities;

public class JsonValidator : IJsonValidator
{
    private static readonly char[] JsonDelimiters = ['{', '}', '"', '\\'];

    public bool IsValidUtf8JsonDelimiter(byte[] bytes, int position)
    {
        if (bytes == null || position < 0 || position >= bytes.Length)
            return false;
        char value = (char)bytes[position];
        if (!JsonDelimiters.Contains(value))
            return true;
        return ValidateUtf8DelimiterSafety(bytes.Take(position + 1).ToArray());
    }

    public void ValidateUtf8Safety(string json)
    {
        if (string.IsNullOrEmpty(json)) return;
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        for (int i = 0; i < bytes.Length; i++)
        {
            char value = (char)bytes[i];
            if (JsonDelimiters.Contains(value) && !IsValidUtf8JsonDelimiter(bytes, i))
                throw new InvalidOperationException(
                    $"Unsafe UTF-8 sequence detected at position {i} for delimiter '{value}'. " +
                    "This could interfere with JSON delimiter scanning.");
        }
    }

    public bool IsValidJsonStructure(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            _ = doc;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public bool ValidateUtf8DelimiterSafety(byte[] testBytes)
    {
        if (testBytes == null || testBytes.Length == 0) return false;
        char c = (char)testBytes[^1];
        if (!JsonDelimiters.Contains(c)) return true;
        try
        {
            string text = Encoding.UTF8.GetString(testBytes);
            if (text.Length != testBytes.Length && text.Last() != c)
                return false;
            return true;
        }
        catch (DecoderFallbackException)
        {
            return false;
        }
    }

    public static bool ValidateAllUtf8DelimiterCombinations()
    {
        foreach (char c in JsonDelimiters)
        {
            for (byte b = 0; b < byte.MaxValue; b++)
                for (byte b2 = 0; b2 < byte.MaxValue; b2++)
                    for (byte b3 = 0; b3 < byte.MaxValue; b3++)
                    {
                        byte[] array = new byte[] { b, b2, b3, (byte)c };
                        try
                        {
                            string text = Encoding.UTF8.GetString(array);
                            if (text.Length != array.Length && text.Length > 0 && text.Last() != c)
                                return false;
                        }
                        catch (DecoderFallbackException) { }
                    }
        }
        return true;
    }
}
