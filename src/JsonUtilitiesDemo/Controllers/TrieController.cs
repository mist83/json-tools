using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using JsonUtilities.Indexing;
using JsonUtilitiesDemo.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace JsonUtilitiesDemo.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrieController : ControllerBase
{
    private readonly ILogger<TrieController> _logger;

    public TrieController(ILogger<TrieController> logger) => _logger = logger;

    /// <summary>Build a Trie index from all string values and keys in the JSON, then search by prefix.</summary>
    [HttpPost("index")]
    public async Task<IActionResult> IndexAndSearch([FromBody] TrieIndexRequest request)
    {
        try
        {
            _logger.LogInformation("Trie index+search: '{Term}'", request.SearchTerm);

            using var doc = JsonDocument.Parse(request.JsonContent);
            var trie = new Trie<string>();
            int indexedCount = 0;

            await Task.Run(() => IndexElement(doc.RootElement, trie, ref indexedCount));

            string[] matches = string.IsNullOrWhiteSpace(request.SearchTerm)
                ? []
                : trie.Search(request.SearchTerm).Distinct().ToArray();

            return Ok(new TrieIndexResponse
            {
                Success = true,
                Matches = matches,
                TotalIndexed = indexedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during Trie indexing");
            return Ok(new TrieIndexResponse { Success = false, Error = ex.Message });
        }
    }

    private static void IndexElement(JsonElement element, Trie<string> trie, ref int count)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject())
                {
                    if (!string.IsNullOrWhiteSpace(prop.Name))
                    {
                        trie.Insert(new NodeDataPointer<string>
                        {
                            Keyword = prop.Name.ToLowerInvariant(),
                            Datum = prop.Name
                        });
                        count++;
                    }
                    IndexElement(prop.Value, trie, ref count);
                }
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                    IndexElement(item, trie, ref count);
                break;

            case JsonValueKind.String:
                var str = element.GetString();
                if (string.IsNullOrWhiteSpace(str)) break;
                foreach (var word in str.Split([' ', ',', '.', ';', ':', '-', '_'], StringSplitOptions.RemoveEmptyEntries))
                {
                    if (word.Length > 2)
                    {
                        trie.Insert(new NodeDataPointer<string>
                        {
                            Keyword = word.ToLowerInvariant(),
                            Datum = word
                        });
                        count++;
                    }
                }
                break;

            case JsonValueKind.Number:
                var num = element.ToString();
                if (!string.IsNullOrWhiteSpace(num))
                {
                    trie.Insert(new NodeDataPointer<string> { Keyword = num, Datum = num });
                    count++;
                }
                break;
        }
    }
}
