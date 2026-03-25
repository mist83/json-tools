# JsonUtilities

High-performance C# library for scanning large JSON files with byte-position tracking, JSON path extraction, and prefix-tree indexing.

## Features

| Feature | Description |
|---|---|
| **Byte-Range Scanning** | Extract objects from JSON collections with precise byte positions. Zero-copy `Span<T>` slicing, `ArrayPool` buffers. |
| **JSON Path Extraction** | Navigate nested structures using dot notation (`company.departments.engineering.employees`). |
| **Trie Indexing** | Build searchable prefix-tree indexes for fast lookups across large datasets. |
| **MD5 Hashing** | Stackalloc-based `MD5.HashData` — no intermediate allocations. |
| **UTF-8 Validation** | Validates delimiter safety for multi-byte UTF-8 sequences. |

## Performance Improvements (v2 vs v1)

- `ArrayPool<byte>.Shared` replaces `new byte[]` — eliminates GC pressure on large files
- `Span<T>` slicing for zero-copy object extraction
- `MD5.HashData(ReadOnlySpan<byte>)` with `stackalloc` hash buffer
- 64KB default buffer (was 8KB)
- `StringComparer.OrdinalIgnoreCase` on collection dictionaries
- `MethodImpl(AggressiveInlining)` on hot paths
- `FileStream` with `useAsync: true` and `FileShare.Read`
- `StringBuilder(64)` pre-sized for path segment parsing

## Projects

```
src/
  JsonUtilities/          # Core library (.NET 8 class library)
  JsonUtilitiesDemo/      # ASP.NET Core Lambda API
```

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/scan/byte-range` | Scan collections, return byte ranges + hashes |
| POST | `/api/scan/validate` | Validate JSON structure + UTF-8 safety |
| POST | `/api/pathscan/extract` | Extract objects at dot-notation path |
| POST | `/api/trie/index` | Build trie index + prefix search |

## Live Demo

**Frontend:** https://json-tools.mikesendpoint.com  
**API:** https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws

## Quick Start

```bash
cd src/JsonUtilitiesDemo
dotnet run
# Swagger UI at http://localhost:5000
```

## Usage

```csharp
// Byte-range scanning
var scanner = new GenericByteRangeScanner();
var result = await scanner.ScanAsync(stream, new JsonScanOptions
{
    TargetCollections = ["products", "reviews"],
    CalculateHashes = true,
    IncludeJsonContent = true
});

foreach (var (name, objects) in result.Collections)
    Console.WriteLine($"{name}: {objects.Length} objects");

// JSON path extraction
var pathScanner = new GenericJsonPathScanner();
var pathResult = await pathScanner.ScanAsync(stream, "company.departments.engineering.employees", new JsonPathScanOptions());

// Trie indexing
var trie = new Trie<string>();
trie.Insert(new NodeDataPointer<string> { Keyword = "javascript", Datum = "JavaScript" });
var matches = trie.Search("java"); // ["JavaScript"]
```
