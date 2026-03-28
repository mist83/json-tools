using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace JsonUtilitiesDemo.Support;

internal static class JsonRequestHelpers
{
    public static string[]? ResolveCollectionTargets(string jsonContent, string[]? requestedCollections)
    {
        if (requestedCollections is { Length: > 0 })
            return requestedCollections.Where(static name => !string.IsNullOrWhiteSpace(name)).ToArray();

        return DetectTopLevelArrayCollections(jsonContent);
    }

    public static string[]? DetectTopLevelArrayCollections(string jsonContent)
    {
        if (string.IsNullOrWhiteSpace(jsonContent))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(jsonContent);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            var collections = new List<string>();
            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Array)
                    collections.Add(property.Name);
            }

            return collections.Count > 0 ? collections.ToArray() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
