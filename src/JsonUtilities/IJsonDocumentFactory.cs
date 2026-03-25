using System.Text.Json;

namespace JsonUtilities;

public interface IJsonDocumentFactory<T>
{
    T Create(JsonDocument document);
}
