using System.Text.Json;

namespace JsonUtilities;

/// <summary>
/// Defines a factory for creating typed objects from a <see cref="JsonDocument"/>.
/// Implement this interface to provide custom deserialization logic for specific JSON structures.
/// </summary>
/// <typeparam name="T">The type of object to create from the JSON document.</typeparam>
public interface IJsonDocumentFactory<T>
{
    /// <summary>
    /// Creates an instance of <typeparamref name="T"/> from the provided <see cref="JsonDocument"/>.
    /// </summary>
    /// <param name="document">The parsed JSON document to convert.</param>
    /// <returns>An instance of <typeparamref name="T"/> populated from the document.</returns>
    T Create(JsonDocument document);
}
