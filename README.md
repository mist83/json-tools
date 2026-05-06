# JsonUtilities

[![CI](https://github.com/mist83/json-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/mist83/json-tools/actions/workflows/ci.yml)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
[![Tests](https://img.shields.io/badge/tests-117%20passing-brightgreen?logo=xunit)](https://github.com/mist83/json-tools/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

High-performance C# library for scanning large JSON files with byte-position tracking, JSON path extraction, prefix-tree indexing, and semantic keyword search — without full deserialization.

## ✨ Features

| Feature | Description |
|---|---|
| **Byte-Range Scanning** | Extract objects from JSON collections with precise byte positions. Zero-copy `Span<T>` slicing, `ArrayPool` buffers. |
| **JSON Path Extraction** | Navigate nested structures using dot notation (`company.departments.engineering.employees`). |
| **Trie Indexing** | Build searchable prefix-tree indexes for fast O(prefix_length) lookups across large datasets. |
| **Semantic Search** | Index specific JSON fields (title, cast, description) by keyword → byte offset. Search 500 MB files in milliseconds. |
| **Parallel Processing** | Channel-based producer/consumer for concurrent object hashing and validation. |
| **MD5 Hashing** | Stackalloc-based `MD5.HashData` — no intermediate allocations. |
| **UTF-8 Validation** | Validates delimiter safety for multi-byte UTF-8 sequences. |
| **Fluent API** | Discoverable, chainable builder API via `JsonTools`. |
| **Browser Preview** | Privacy-first, zero-network preview mode in the demo UI. Keeps JSON in the tab while mirroring the API contract for curious users. |

## 🚀 Live Demo

**Frontend:** https://json-tools.mullmania.com
**API (Swagger):** https://tf4qymuc4kepzxytuk3dinfjbq0lwyyw.lambda-url.us-west-2.on.aws

### Demo Execution Modes

- **Hosted API** — the public site talks to the deployed .NET API
- **Local API** — `dotnet run` serves the UI and API together on localhost
- **Browser Preview** — keeps JSON in the browser tab for privacy-sensitive experimentation

## 📦 Quick Start

```bash
# Clone and run the full demo locally
git clone https://github.com/mist83/json-tools.git
cd json-tools
dotnet run --project src/JsonUtilitiesDemo/JsonUtilitiesDemo.csproj --urls http://localhost:5968
# Demo UI at http://localhost:5968
# Swagger UI at http://localhost:5968/swagger
```

## 🔧 Usage

### Byte-Range Scanning (Fluent API)

```csharp
var result = await JsonTools.Scan(stream)
    .ForCollections("products", "reviews")
    .WithHashes()
    .WithContent()
    .RunAsync();

foreach (var (name, objects) in result.Collections)
    Console.WriteLine($"{name}: {objects.Length} objects");
```

### Streaming Byte-Range Processing

```csharp
await JsonTools.Scan(stream)
    .ForCollections("products")
    .SkipValidation()
    .ProcessAsync((collection, obj) =>
    {
        Console.WriteLine($"{collection} [{obj.StartPosition}+{obj.Length}]");
    });
```

Use `ProcessAsync(...)` when the input stream may be larger than RAM and you want to process objects incrementally instead of collecting the entire scan result first.

### JSON Path Extraction

```csharp
var result = await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
    .WithContent()
    .WithHashes()
    .RunAsync();

foreach (var obj in result.Objects)
    Console.WriteLine($"[{obj.StartPosition}+{obj.Length}] {obj.JsonContent}");
```

### Streaming JSON Path Processing

```csharp
await JsonTools.ExtractPath(stream, "company.departments.engineering.employees")
    .SkipValidation()
    .ProcessAsync(obj =>
    {
        Console.WriteLine($"[{obj.ItemIndex}] {obj.StartPosition}+{obj.Length}");
    });
```

Use `ProcessAsync(...)` here when the target path can contain many objects and you want to keep memory bounded instead of materializing the whole result set first.

### Trie Indexing

```csharp
var trie = JsonTools.BuildTrie(items, item => new[] { item.Title, item.Genre });
var matches = trie.Search("action"); // prefix search → all items starting with "action"
bool exact = trie.ContainsExact("action-thriller");
```

### Semantic Search Index

```csharp
// Build a keyword → byte-offset index from specific fields
var index = await JsonTools.BuildSemanticIndex(filePath, new SemanticIndexOptions
{
    IndexedFields = ["title", "cast", "description"],
    CollectionPaths = ["shows"],
    IndexNGrams = true   // enables "tom hanks" phrase search
});

// Search returns byte offsets — never loads the full file
long[] offsets = index.Search("hanks");

// Lazily read matching objects from disk
foreach (var json in index.SearchObjects("hanks", filePath))
    Console.WriteLine(json);
```

The demo UI now exposes the same pipeline through `POST /api/semantic/search`, so the semantic-search tab can use the real C# index in Hosted API and Local API modes.

### Direct Scanner Access

```csharp
// Low-level access for advanced scenarios
var scanner = JsonTools.CreateScanner();
var result = await scanner.ScanAsync(stream, new JsonScanOptions
{
    TargetCollections = ["products"],
    CalculateHashes = true,
    IncludeJsonContent = true,
    ParallelProcessing = true,   // Channel<T> producer/consumer
    SkipStructureValidation = true  // skip JsonDocument.Parse for trusted input
});
```

## 📐 Architecture

```
src/
  JsonUtilities/              # Core library (.NET 8 class library)
    JsonTools.cs              # Static fluent entry point
    GenericByteRangeScanner   # Byte-range scan with parallel processing
    GenericJsonPathScanner    # Dot-notation path extraction
    JsonValidator             # UTF-8 + structure validation
    JsonStreamIndexer         # Synchronous streaming path indexer
    Fluent/
      ScanBuilder             # Fluent builder for byte-range scans
      PathScanBuilder         # Fluent builder for path scans
    Indexing/
      Trie<T>                 # Generic prefix tree
      TrieBuilder<T>          # Batch trie construction
      JsonIndex               # Semantic index (keyword → byte offsets)
      SemanticIndexBuilder    # Builds JsonIndex from stream
      SemanticIndexOptions    # Configuration for semantic indexing
    Models/
      JsonScanOptions         # Scan configuration
      JsonScanResult          # Scan output + metadata
      JsonObjectRange         # Single object: position, length, hash, content
      ScanMetadata            # Timing, throughput, worker stats

  JsonUtilitiesDemo/          # ASP.NET Core Lambda API
    Controllers/
      ScanController          # POST /api/scan/byte-range, /api/scan/validate
      PathScanController      # POST /api/pathscan/extract
      TrieController          # POST /api/trie/index
      SemanticController      # POST /api/semantic/search

tests/
  JsonUtilities.Tests/        # 117 xUnit tests
    ByteRangeScannerTests     # ~25 cases: extraction, positions, hashing, edge cases
    JsonPathScannerTests      # ~18 cases: nested paths, strict mode, byte accuracy
    TrieTests                 # ~17 cases: insert, search, prefix, unicode, large dataset
    ValidatorTests            # ~17 cases: structure, UTF-8, delimiter safety
    SemanticIndexTests        # ~14 cases: indexing, search, n-grams, memory
    FluentApiTests            # ~14 cases: full fluent chain coverage
    IntegrationTests          # ~10 ETL pipeline scenarios
```

## 🌐 API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/scan/byte-range` | Scan collections, return byte ranges + hashes |
| POST | `/api/scan/validate` | Validate JSON structure + UTF-8 safety |
| POST | `/api/pathscan/extract` | Extract objects at dot-notation path |
| POST | `/api/trie/index` | Build trie index + prefix search |
| POST | `/api/semantic/search` | Build semantic index from selected fields, then search for matching objects |
| GET | `/api/health` | Simple health probe for localhost and hosted checks |

## 🧭 WASM Direction

If you want a future “no upload, no install, still real C#” story, WebAssembly is a good fit for the core library but not for pretending the browser is a real socket-listening web server. The cleaner path is:

- keep the request/response contract stable
- reuse `JsonUtilities` directly from a browser host
- swap HTTP for an in-process adapter when running in WebAssembly

Today’s Browser Preview mode is the low-friction bridge: users can keep data local now, while the UI and API contract stay aligned with a later C# WebAssembly implementation.

### Current Status

There is no checked-in Blazor/WebAssembly host in this repo yet. If you deploy the repo exactly as it stands today, you get the current HTML/CSS/JS demo:

- **Hosted API** mode calls the deployed .NET backend
- **Local API** mode calls `http://localhost:5968`
- **Browser Preview** keeps data local, but it is still the JavaScript mirror path

That means a deploy by itself does **not** produce the “no upload, still real C# in the browser” version yet.

For the next step, including the exact project scaffold, contract-sharing plan, local verification, and S3/CloudFront publish handoff, see [docs/blazor-wasm/README.md](docs/blazor-wasm/README.md).

## ⚡ Performance

- `ArrayPool<byte>.Shared` replaces `new byte[]` — eliminates GC pressure on large files
- `Span<T>` slicing for zero-copy object extraction
- `MD5.HashData(ReadOnlySpan<byte>)` with `stackalloc` hash buffer
- 64KB default I/O buffer (was 8KB in v1)
- `StringComparer.OrdinalIgnoreCase` on collection dictionaries
- `MethodImpl(AggressiveInlining)` on hot paths
- `FileStream` with `useAsync: true` and `FileShare.Read`
- Semantic and path benchmarks are now tracked in-repo; the latest local sample built a 10,000-item semantic index in ~56 ms, searched offsets in ~164 us, materialized 10,000 matched objects in ~2.47 ms, and processed a 10,000-item nested path in ~9.26 ms on an Apple M4. See [docs/performance/README.md](docs/performance/README.md).

For repeatable local evidence, use the BenchmarkDotNet harness in [docs/performance/README.md](docs/performance/README.md).

## 🧪 Running Tests

```bash
dotnet test
# Passed! - Failed: 0, Passed: 117, Skipped: 0
```

For the full local browser smoke path:

```bash
cd e2e
npm run smoke:local
```

```bash
# With coverage
dotnet test --collect:"XPlat Code Coverage"
```

## 📋 Requirements

- .NET 8.0+
- No external runtime dependencies (core library)
- Demo API: `Amazon.Lambda.AspNetCoreServer.Hosting`, `Swashbuckle.AspNetCore`
- Demo UI: plain HTML/CSS/JS served by the ASP.NET Core demo locally or by static hosting in production
