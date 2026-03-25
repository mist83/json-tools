namespace JsonUtilities;

/// <summary>
/// Defines the contract for JSON validation utilities, including UTF-8 safety checks
/// and structural JSON validation.
/// </summary>
public interface IJsonValidator
{
    /// <summary>
    /// Determines whether the byte at the specified position in a byte array is a valid
    /// UTF-8 encoded JSON delimiter character (e.g. <c>{</c>, <c>}</c>, <c>"</c>, <c>\</c>).
    /// </summary>
    /// <param name="bytes">The byte array to inspect.</param>
    /// <param name="position">Zero-based index of the byte to check.</param>
    /// <returns><c>true</c> if the byte is a safe JSON delimiter; <c>false</c> if it could be a multi-byte UTF-8 sequence tail.</returns>
    bool IsValidUtf8JsonDelimiter(byte[] bytes, int position);

    /// <summary>
    /// Validates that a JSON string does not contain unsafe UTF-8 multi-byte sequences
    /// that could be misinterpreted as JSON delimiter characters during byte-level scanning.
    /// </summary>
    /// <param name="json">The JSON string to validate.</param>
    /// <exception cref="System.InvalidOperationException">Thrown when an unsafe UTF-8 sequence is detected.</exception>
    void ValidateUtf8Safety(string json);

    /// <summary>
    /// Determines whether the given string is structurally valid JSON by attempting to parse it.
    /// </summary>
    /// <param name="json">The string to validate.</param>
    /// <returns><c>true</c> if the string is valid JSON; <c>false</c> otherwise.</returns>
    bool IsValidJsonStructure(string json);

    /// <summary>
    /// Validates that the last byte in the provided byte array, when interpreted as a JSON delimiter,
    /// is not the tail byte of a multi-byte UTF-8 sequence.
    /// </summary>
    /// <param name="testBytes">Byte array ending with the delimiter byte to test.</param>
    /// <returns><c>true</c> if the delimiter is safe; <c>false</c> if it could be a UTF-8 sequence tail.</returns>
    bool ValidateUtf8DelimiterSafety(byte[] testBytes);
}
