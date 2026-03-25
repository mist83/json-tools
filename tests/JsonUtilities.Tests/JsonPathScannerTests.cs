using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using JsonUtilities.Models;
using Xunit;

namespace JsonUtilities.Tests;

public class JsonPathScannerTests
{
    private readonly GenericJsonPathScanner _scanner = new();

    [Fact]
    public async Task ScanAsync_SingleLevelPath_ExtractsObjects()
    {
        using var stream = Helpers.ToStream(@"{""employees"":[{""id"":1},{""id"":2}]}");
        var result = await _scanner.ScanAsync(stream, "employees", new JsonPathScanOptions
        {
            IncludeJsonContent = true,
            CalculateHashes = false
        });

        result.Objects.Should().HaveCount(2);
        result.HasErrors.Should().BeFalse();
    }

    [Fact]
    public async Task ScanAsync_DeepNestedPath_ExtractsObjects()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await _scanner.ScanAsync(stream, "company.departments.engineering.employees",
            new JsonPathScanOptions { IncludeJsonContent = true, CalculateHashes = false });

        result.Objects.Should().HaveCount(3);
        result.Objects.All(o => o.JsonContent!.Contains("\"id\"")).Should().BeTrue();
    }

    [Fact]
    public async Task ScanAsync_SalesPath_ExtractsObjects()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await _scanner.ScanAsync(stream, "company.departments.sales.employees",
            new JsonPathScanOptions { IncludeJsonContent = true, CalculateHashes = false });

        result.Objects.Should().HaveCount(2);
    }

    [Fact]
    public async Task ScanAsync_PathNotFound_ReturnsEmptyResult()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, "nonexistent.path",
            new JsonPathScanOptions());

        result.Objects.Should().BeEmpty();
        result.HasErrors.Should().BeFalse(); // not found is not an error
    }

    [Fact]
    public async Task ScanAsync_EmptyPath_ReturnsError()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, "",
            new JsonPathScanOptions());

        result.HasErrors.Should().BeTrue();
        result.ValidationErrors.Should().ContainMatch("*empty*");
    }

    [Fact]
    public async Task ScanAsync_CaseInsensitivePath_Matches()
    {
        using var stream = Helpers.ToStream(@"{""Employees"":[{""id"":1},{""id"":2}]}");
        var result = await _scanner.ScanAsync(stream, "employees",
            new JsonPathScanOptions { IncludeJsonContent = true, StrictMode = false });

        result.Objects.Should().HaveCount(2);
    }

    [Fact]
    public async Task ScanAsync_StrictMode_CaseSensitive_NoMatch()
    {
        using var stream = Helpers.ToStream(@"{""Employees"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, "employees",
            new JsonPathScanOptions { StrictMode = true });

        result.Objects.Should().BeEmpty();
    }

    [Fact]
    public async Task ScanAsync_StrictMode_ExactCase_Matches()
    {
        using var stream = Helpers.ToStream(@"{""Employees"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, "Employees",
            new JsonPathScanOptions { StrictMode = true, IncludeJsonContent = true });

        result.Objects.Should().HaveCount(1);
    }

    [Fact]
    public async Task ScanAsync_BytePositions_AccurateForPathExtraction()
    {
        const string json = @"{""items"":[{""id"":1,""name"":""alpha""},{""id"":2,""name"":""beta""}]}";
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        using var stream = new System.IO.MemoryStream(bytes);

        var result = await _scanner.ScanAsync(stream, "items",
            new JsonPathScanOptions { IncludeJsonContent = true, CalculateHashes = false });

        foreach (var obj in result.Objects)
        {
            var slice = Encoding.UTF8.GetString(bytes, (int)obj.StartPosition, (int)obj.Length);
            new JsonValidator().IsValidJsonStructure(slice).Should().BeTrue();
        }
    }

    [Fact]
    public async Task ScanAsync_HashCalculation_CorrectForExtractedObjects()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, "items",
            new JsonPathScanOptions { IncludeJsonContent = true, CalculateHashes = true });

        result.Objects.First().Hash.Should().NotBeNullOrEmpty();
        result.Objects.First().Hash.Should().MatchRegex("^[0-9a-f]{32}$");
    }

    [Fact]
    public async Task ScanAsync_ItemIndexes_AreSequential()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await _scanner.ScanAsync(stream, "company.departments.engineering.employees",
            new JsonPathScanOptions { IncludeJsonContent = false });

        var indexes = result.Objects.Select(o => o.ItemIndex).ToArray();
        indexes.Should().BeInAscendingOrder();
        indexes.First().Should().Be(0);
    }

    [Fact]
    public async Task ScanAsync_FilePath_Overload_Works()
    {
        var result = await _scanner.ScanAsync(
            Helpers.FixturePath("nested.json"),
            "company.departments.engineering.employees",
            new JsonPathScanOptions { IncludeJsonContent = true });

        result.Objects.Should().HaveCount(3);
    }

    [Fact]
    public async Task ScanAsync_FilePath_NotFound_ReturnsError()
    {
        var result = await _scanner.ScanAsync("/nonexistent/file.json", "items",
            new JsonPathScanOptions());

        result.HasErrors.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessStreamAsync_CallbackInvokedForEachObject()
    {
        int count = 0;
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1},{""id"":2},{""id"":3}]}");
        await _scanner.ProcessStreamAsync(stream, "items",
            _ => count++,
            new JsonPathScanOptions());

        count.Should().Be(3);
    }

    [Fact]
    public async Task ScanAsync_SkipStructureValidation_StillExtractsObjects()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await _scanner.ScanAsync(stream, "company.departments.engineering.employees",
            new JsonPathScanOptions { IncludeJsonContent = true, SkipStructureValidation = true });

        result.Objects.Should().HaveCount(3);
    }

    [Fact]
    public async Task ScanAsync_Metadata_TotalObjectsFound_IsAccurate()
    {
        using var stream = Helpers.LoadFixture("nested.json");
        var result = await _scanner.ScanAsync(stream, "company.departments.engineering.employees",
            new JsonPathScanOptions());

        result.Metadata.TotalObjectsFound.Should().Be(3);
        result.Metadata.BytesProcessed.Should().BeGreaterThan(0);
    }
}
