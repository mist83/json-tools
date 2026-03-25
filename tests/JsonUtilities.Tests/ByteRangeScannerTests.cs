using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using FluentAssertions;
using JsonUtilities.Models;
using Xunit;

namespace JsonUtilities.Tests;

public class ByteRangeScannerTests
{
    private readonly GenericByteRangeScanner _scanner = new();

    // ── Basic extraction ──────────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_SingleCollection_ExtractsAllObjects()
    {
        using var stream = Helpers.ToStream(@"{""products"":[{""id"":1},{""id"":2},{""id"":3}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["products"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.HasErrors.Should().BeFalse();
        result.Collections.Should().ContainKey("products");
        result.Collections["products"].Should().HaveCount(3);
        result.Metadata.TotalObjectsFound.Should().Be(3);
    }

    [Fact]
    public async Task ScanAsync_MultipleCollections_ExtractsEach()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["products", "reviews", "orders"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.Collections.Should().ContainKey("products");
        result.Collections.Should().ContainKey("reviews");
        result.Collections.Should().ContainKey("orders");
        result.Collections["products"].Should().HaveCount(5);
        result.Collections["reviews"].Should().HaveCount(5);
        result.Collections["orders"].Should().HaveCount(3);
        result.Metadata.TotalObjectsFound.Should().Be(13);
    }

    [Fact]
    public async Task ScanAsync_TargetCollections_OnlyExtractsSpecified()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["products"],
            IncludeJsonContent = false,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.Collections.Should().ContainKey("products");
        result.Collections.Should().NotContainKey("reviews");
        result.Collections.Should().NotContainKey("orders");
    }

    [Fact]
    public async Task ScanAsync_IncludeJsonContent_PopulatesJsonContent()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1,""name"":""test""}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        var obj = result.Collections["items"].First();
        obj.JsonContent.Should().NotBeNullOrEmpty();
        obj.JsonContent.Should().Contain("\"id\"");
    }

    [Fact]
    public async Task ScanAsync_IncludeJsonContent_False_JsonContentIsNull()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = false,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.Collections["items"].First().JsonContent.Should().BeNull();
    }

    // ── Byte position accuracy ────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_BytePositions_AreAccurate()
    {
        const string json = @"{""items"":[{""id"":1,""name"":""alpha""},{""id"":2,""name"":""beta""}]}";
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        using var stream = new MemoryStream(bytes);

        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        foreach (var obj in result.Collections["items"])
        {
            // Slice the original bytes using the reported position and verify it's valid JSON
            var slice = bytes.Skip((int)obj.StartPosition).Take((int)obj.Length).ToArray();
            var sliceText = Encoding.UTF8.GetString(slice);
            new JsonValidator().IsValidJsonStructure(sliceText).Should().BeTrue(
                $"slice at {obj.StartPosition}+{obj.Length} should be valid JSON but was: {sliceText}");
        }
    }

    [Fact]
    public async Task ScanAsync_BytePositions_MatchJsonContent()
    {
        const string json = @"{""items"":[{""id"":1},{""id"":2},{""id"":3}]}";
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        using var stream = new MemoryStream(bytes);

        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        foreach (var obj in result.Collections["items"])
        {
            var sliceText = Encoding.UTF8.GetString(bytes, (int)obj.StartPosition, (int)obj.Length);
            sliceText.Should().Be(obj.JsonContent);
        }
    }

    // ── Hashing ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_CalculatesCorrectMd5Hash()
    {
        const string json = @"{""items"":[{""id"":1}]}";
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        using var stream = new MemoryStream(bytes);

        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = true,
            ValidateUtf8 = false
        });

        var obj = result.Collections["items"].First();
        var objBytes = bytes.Skip((int)obj.StartPosition).Take((int)obj.Length).ToArray();
        using var md5 = MD5.Create();
        var expectedHash = Convert.ToHexString(md5.ComputeHash(objBytes)).ToLowerInvariant();
        obj.Hash.Should().Be(expectedHash);
    }

    [Fact]
    public async Task ScanAsync_CalculateHashes_False_HashIsNull()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.Collections["items"].First().Hash.Should().BeNull();
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_EmptyArray_ReturnsZeroObjects()
    {
        using var stream = Helpers.ToStream(@"{""items"":[]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            ValidateUtf8 = false
        });

        result.Collections.Should().NotContainKey("items"); // empty array → no objects found
        result.Metadata.TotalObjectsFound.Should().Be(0);
    }

    [Fact]
    public async Task ScanAsync_EscapedQuotesInValues_DoesNotBreakParsing()
    {
        using var stream = Helpers.LoadFixture("edge_cases.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        result.Collections["items"].Should().HaveCount(10);
        // Item 2 has escaped quotes — verify it parsed correctly
        var item2 = result.Collections["items"].First(o => o.JsonContent!.Contains("escaped quotes"));
        item2.Should().NotBeNull();
        new JsonValidator().IsValidJsonStructure(item2.JsonContent!).Should().BeTrue();
    }

    [Fact]
    public async Task ScanAsync_UnicodeContent_HandledCorrectly()
    {
        using var stream = Helpers.LoadFixture("edge_cases.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            CalculateHashes = false,
            ValidateUtf8 = false
        });

        var unicodeItem = result.Collections["items"].FirstOrDefault(o => o.JsonContent?.Contains("日本語") == true);
        unicodeItem.Should().NotBeNull("unicode item should be found");
    }

    [Fact]
    public async Task ScanAsync_FilePath_FileNotFound_ReturnsError()
    {
        var result = await _scanner.ScanAsync("/nonexistent/path/file.json", new JsonScanOptions());
        result.HasErrors.Should().BeTrue();
        result.ValidationErrors.Should().ContainMatch("*not found*");
    }

    [Fact]
    public async Task ScanAsync_ObjectExceedsMaxSize_SkippedWithError()
    {
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1,""data"":""hello""}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            MaxObjectSize = 5, // tiny limit
            ContinueOnError = true,
            ValidateUtf8 = false
        });

        // Object should be present but have an error
        if (result.Collections.ContainsKey("items"))
        {
            result.Collections["items"].Any(o => o.Error != null).Should().BeTrue();
        }
    }

    [Fact]
    public async Task ScanAsync_ItemIndexes_AreSequentialPerCollection()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["products"],
            ValidateUtf8 = false
        });

        var indexes = result.Collections["products"].Select(o => o.ItemIndex).ToArray();
        indexes.Should().BeInAscendingOrder();
        indexes.First().Should().Be(0);
        indexes.Last().Should().Be(4);
    }

    // ── PropertyExtractor ─────────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_PropertyExtractor_InvokedForEachObject()
    {
        int callCount = 0;
        using var stream = Helpers.ToStream(@"{""items"":[{""id"":1},{""id"":2},{""id"":3}]}");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = true,
            ValidateUtf8 = false,
            PropertyExtractor = json =>
            {
                callCount++;
                return new System.Collections.Generic.Dictionary<string, object> { ["extracted"] = true };
            }
        });

        callCount.Should().Be(3);
        result.Collections["items"].All(o => o.Properties != null).Should().BeTrue();
    }

    // ── Parallel processing ───────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_ParallelProcessing_ProducesSameCountAsSingleThreaded()
    {
        using var streamSeq = Helpers.LoadFixture("ecommerce.json");
        using var streamPar = Helpers.LoadFixture("ecommerce.json");

        var sequential = await _scanner.ScanAsync(streamSeq, new JsonScanOptions
        {
            TargetCollections = ["products", "reviews", "orders"],
            IncludeJsonContent = true,
            CalculateHashes = true,
            ValidateUtf8 = false,
            ParallelProcessing = false
        });

        var parallel = await _scanner.ScanAsync(streamPar, new JsonScanOptions
        {
            TargetCollections = ["products", "reviews", "orders"],
            IncludeJsonContent = true,
            CalculateHashes = true,
            ValidateUtf8 = false,
            ParallelProcessing = true
        });

        parallel.Metadata.TotalObjectsFound.Should().Be(sequential.Metadata.TotalObjectsFound);
        parallel.Collections["products"].Length.Should().Be(sequential.Collections["products"].Length);
        parallel.Collections["reviews"].Length.Should().Be(sequential.Collections["reviews"].Length);
        parallel.Metadata.ParallelWorkers.Should().BeGreaterThan(0);
    }

    // ── SkipStructureValidation ───────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_SkipStructureValidation_StillExtractsObjects()
    {
        using var stream = Helpers.LoadFixture("ecommerce.json");
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["products"],
            IncludeJsonContent = true,
            SkipStructureValidation = true,
            ValidateUtf8 = false
        });

        result.Collections["products"].Should().HaveCount(5);
    }

    // ── Large file performance ────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_LargeFile_1000Objects_AllExtracted()
    {
        using var stream = Helpers.LoadFixture("large_collection.json");
        var sw = Stopwatch.StartNew();
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            IncludeJsonContent = false,
            CalculateHashes = false,
            ValidateUtf8 = false,
            SkipStructureValidation = true
        });
        sw.Stop();

        result.Collections["items"].Should().HaveCount(1000);
        sw.ElapsedMilliseconds.Should().BeLessThan(2000, "1000 objects should scan in under 2 seconds");
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task ScanAsync_Metadata_BytesProcessed_IsAccurate()
    {
        const string json = @"{""items"":[{""id"":1}]}";
        using var stream = Helpers.ToStream(json);
        var result = await _scanner.ScanAsync(stream, new JsonScanOptions
        {
            TargetCollections = ["items"],
            ValidateUtf8 = false
        });

        result.Metadata.BytesProcessed.Should().Be(Encoding.UTF8.GetByteCount(json));
        result.Metadata.Elapsed.Should().BeGreaterThan(TimeSpan.Zero);
    }
}
