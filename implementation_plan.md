# Implementation Plan

[Overview]
Transform JsonUtilities into an ETL-grade, battle-tested, zero-friction JSON scanning and indexing library with exhaustive tests, parallel object processing, a fluent builder API, semantic byte-offset indexing, and complete XML documentation.

JsonUtilities is a high-performance C# .NET 8 library for scanning large JSON files without full deserialization. It uses byte-range tracking, dot-notation path extraction, and prefix-tree (Trie) indexing. The current v2.0 codebase is functionally correct but lacks: (1) a test suite, (2) a developer-friendly fluent API, (3) parallel processing within a single file, (4) semantic search capability (cast/description lookup by keyword → byte offset), and (5) XML documentation on all public members. This plan addresses all five gaps to make the library production-ready for ETL injection pipelines.

[Types]
New and modified types to support fluent API, parallel processing, and semantic indexing.

**New types:**

`ScanBuilder` (src/JsonUtilities/Fluent/ScanBuilder.cs)
- Fields: `Stream _stream`, `JsonScanOptions _options`
- Methods: `ForCollections(params string[])`, `WithHashes()`, `WithContent()`, `WithPropertyExtractor(Func<...>)`, `SkipValidation()`, `Parallel()`, `RunAsync() → Task<JsonScanResult>`

`PathScanBuilder` (src/JsonUtilities/Fluent/PathScanBuilder.cs)
- Fields: `Stream _stream`, `string _path`, `JsonPathScanOptions _options`
- Methods: `WithHashes()`, `WithContent()`, `StrictMode()`, `RunAsync() → Task<JsonPathScanResult>`

`JsonTools` (src/JsonUtilities/JsonTools.cs)
- Static entry point: `Scan(Stream)`, `Scan(string filePath)`, `ExtractPath(Stream, string)`, `ExtractPath(string filePath, string)`, `BuildTrie<T>(IEnumerable<T>, Func<T,string[]>)`, `BuildSemanticIndex(Stream, SemanticIndexOptions)`

`JsonIndex` (src/JsonUtilities/Indexing/JsonIndex.cs)
- Wraps `Trie<long>` (keyword → byte offset list)
- Methods: `Search(string prefix) → long[]`, `SearchObjects(string prefix, Stream source) → IEnumerable<string>`, `Count → int`

`SemanticIndexBuilder` (src/JsonUtilities/Indexing/SemanticIndexBuilder.cs)
- Builds a `JsonIndex` from a stream by scanning objects and tokenizing specified fields
- Fields: `SemanticIndexOptions _options`
- Methods: `BuildAsync(Stream) → Task<JsonIndex>`, `BuildAsync(string filePath) → Task<JsonIndex>`

`SemanticIndexOptions` (src/JsonUtilities/Indexing/SemanticIndexOptions.cs)
- `string[] IndexedFields` — which JSON fields to tokenize (e.g. ["title","cast","description"])
- `string[] CollectionPaths` — dot-notation paths to scan
- `bool CaseSensitive` — default false
- `int MinWordLength` — default 2
- `bool IndexNGrams` — index 2-word phrases for proximity search, default false
- `int MaxNGramLength` — default 2

**Modified types:**

`JsonScanOptions` — add `bool ParallelProcessing` (default false), `bool SkipStructureValidation` (default false)
`JsonObjectRange` — no structural changes, just XML docs
`ScanMetadata` — add `int ParallelWorkers` property

[Files]
New files to create and existing files to modify.

**New files:**
- `src/JsonUtilities/JsonTools.cs` — static fluent entry point
- `src/JsonUtilities/Fluent/ScanBuilder.cs` — byte-range scan builder
- `src/JsonUtilities/Fluent/PathScanBuilder.cs` — path scan builder
- `src/JsonUtilities/Indexing/JsonIndex.cs` — semantic index (trie of byte offsets)
- `src/JsonUtilities/Indexing/SemanticIndexBuilder.cs` — builds JsonIndex from stream
- `src/JsonUtilities/Indexing/SemanticIndexOptions.cs` — options for semantic indexing
- `tests/JsonUtilities.Tests/JsonUtilities.Tests.csproj` — xUnit test project
- `tests/JsonUtilities.Tests/ByteRangeScannerTests.cs` — ~40 test cases
- `tests/JsonUtilities.Tests/JsonPathScannerTests.cs` — ~25 test cases
- `tests/JsonUtilities.Tests/TrieTests.cs` — ~20 test cases
- `tests/JsonUtilities.Tests/ValidatorTests.cs` — ~15 test cases
- `tests/JsonUtilities.Tests/IntegrationTests.cs` — ETL pipeline + semantic search scenarios
- `tests/JsonUtilities.Tests/FluentApiTests.cs` — fluent builder API tests
- `tests/JsonUtilities.Tests/SemanticIndexTests.cs` — semantic index tests
- `tests/JsonUtilities.Tests/TestData/ecommerce.json` — e-commerce fixture (products/reviews/orders)
- `tests/JsonUtilities.Tests/TestData/catalog.json` — TV/movie catalog fixture (title/cast/description)
- `tests/JsonUtilities.Tests/TestData/nested.json` — deeply nested structure fixture
- `tests/JsonUtilities.Tests/TestData/large_collection.json` — 1000+ objects for perf tests
- `tests/JsonUtilities.Tests/TestData/edge_cases.json` — escaped quotes, unicode, empty arrays

**Modified files:**
- `src/JsonUtilities/GenericByteRangeScanner.cs` — XML docs on all public members; fix buffer copy (use rented buffer directly); add parallel object processing via Channel<T> when ParallelProcessing=true; make structure validation optional
- `src/JsonUtilities/GenericJsonPathScanner.cs` — XML docs; make IsValidJsonStructure optional via SkipStructureValidation
- `src/JsonUtilities/JsonStreamIndexer.cs` — XML docs on all public members
- `src/JsonUtilities/JsonValidator.cs` — XML docs on all public members
- `src/JsonUtilities/IJsonScanner.cs` — XML docs
- `src/JsonUtilities/IJsonPathScanner.cs` — XML docs
- `src/JsonUtilities/IJsonValidator.cs` — XML docs
- `src/JsonUtilities/IJsonDocumentFactory.cs` — XML docs
- `src/JsonUtilities/Indexing/Trie.cs` — XML docs; add `ContainsExact(string)` method
- `src/JsonUtilities/Indexing/TrieBuilder.cs` — XML docs
- `src/JsonUtilities/Indexing/Node.cs` — XML docs
- `src/JsonUtilities/Indexing/NodeDataPointer.cs` — XML docs
- `src/JsonUtilities/Models/JsonObjectRange.cs` — XML docs
- `src/JsonUtilities/Models/JsonScanOptions.cs` — XML docs; add ParallelProcessing, SkipStructureValidation
- `src/JsonUtilities/Models/JsonPathScanOptions.cs` — XML docs
- `src/JsonUtilities/Models/JsonScanResult.cs` — XML docs
- `src/JsonUtilities/Models/JsonPathScanResult.cs` — XML docs
- `src/JsonUtilities/Models/ScanMetadata.cs` — XML docs; add ParallelWorkers
- `JsonTools.sln` — add test project reference

[Functions]
New and modified functions.

**New functions:**

`JsonTools.Scan(Stream stream) → ScanBuilder`
`JsonTools.Scan(string filePath) → ScanBuilder`
`JsonTools.ExtractPath(Stream stream, string jsonPath) → PathScanBuilder`
`JsonTools.ExtractPath(string filePath, string jsonPath) → PathScanBuilder`
`JsonTools.BuildTrie<T>(IEnumerable<T> items, Func<T, string[]> wordExtractor) → Trie<T>`
`JsonTools.BuildSemanticIndex(Stream stream, SemanticIndexOptions options) → Task<JsonIndex>`
`JsonTools.BuildSemanticIndex(string filePath, SemanticIndexOptions options) → Task<JsonIndex>`

`ScanBuilder.ForCollections(params string[] collections) → ScanBuilder`
`ScanBuilder.WithHashes() → ScanBuilder`
`ScanBuilder.WithContent() → ScanBuilder`
`ScanBuilder.WithPropertyExtractor(Func<string, Dictionary<string,object>> extractor) → ScanBuilder`
`ScanBuilder.SkipValidation() → ScanBuilder`
`ScanBuilder.Parallel() → ScanBuilder`
`ScanBuilder.RunAsync() → Task<JsonScanResult>`

`PathScanBuilder.WithHashes() → PathScanBuilder`
`PathScanBuilder.WithContent() → PathScanBuilder`
`PathScanBuilder.StrictMode() → PathScanBuilder`
`PathScanBuilder.RunAsync() → Task<JsonPathScanResult>`

`JsonIndex.Search(string prefix) → long[]`
`JsonIndex.SearchObjects(string prefix, Stream source) → IEnumerable<string>`
`JsonIndex.SearchObjects(string prefix, string filePath) → IEnumerable<string>`
`JsonIndex.Count → int`

`SemanticIndexBuilder.BuildAsync(Stream stream) → Task<JsonIndex>`
`SemanticIndexBuilder.BuildAsync(string filePath) → Task<JsonIndex>`

`Trie<T>.ContainsExact(string keyword) → bool` (new method)

**Modified functions:**

`GenericByteRangeScanner.ScanAsync(Stream, JsonScanOptions)` — when `options.ParallelProcessing=true`, use `Channel<(JsonObjectRange, string, byte[])>` to process found objects in parallel worker tasks; fix `rentedBuffer[..length]` copy to work directly on rented buffer slice
`GenericByteRangeScanner.ProcessFoundObject(...)` — add `options.SkipStructureValidation` check to skip `IsValidJsonStructure` call
`GenericJsonPathScanner.ExtractJsonObjectsAsync(...)` — add `options.SkipStructureValidation` check

[Classes]
New and modified classes.

**New classes:**

`JsonTools` (static) — single entry point for all library operations; zero-config defaults; designed for discoverability

`ScanBuilder` — immutable-style fluent builder for byte-range scans; each method returns `this` for chaining; `RunAsync()` creates scanner and executes

`PathScanBuilder` — fluent builder for path scans

`JsonIndex` — wraps `Trie<long>` where each terminal node stores a list of byte offsets; `SearchObjects` performs lazy byte-range reads from source stream on demand; memory-efficient because content is never stored, only positions

`SemanticIndexBuilder` — scans a JSON stream, for each object at specified paths extracts configured fields, tokenizes values into words (and optionally n-grams), inserts `word → startPosition` into the index; uses the existing `GenericByteRangeScanner` internally

`SemanticIndexOptions` — configuration for semantic indexing

**Modified classes:**

`GenericByteRangeScanner` — parallel processing path: after the sequential byte scan identifies object boundaries, a `Channel<WorkItem>` feeds N worker tasks that process (hash, validate, extract) objects concurrently; the sequential scan itself stays single-threaded (correct — you can't parallelize a byte-by-byte state machine)

`Trie<T>` — add `ContainsExact` for O(n) exact match without BFS traversal

[Dependencies]
New packages needed for the test project.

**Test project packages:**
- `xunit` Version 2.9.0
- `xunit.runner.visualstudio` Version 2.8.2
- `Microsoft.NET.Test.Sdk` Version 17.11.1
- `FluentAssertions` Version 6.12.0 — readable test assertions
- `coverlet.collector` Version 6.0.2 — code coverage

**Core library** — no new dependencies; `System.Threading.Channels` is in-box with .NET 8

[Testing]
Exhaustive test coverage across all public APIs with real JSON fixtures.

**ByteRangeScannerTests.cs (~40 cases):**
- `ScanAsync_EmptyJson_ReturnsEmptyCollections`
- `ScanAsync_SingleCollection_ExtractsAllObjects`
- `ScanAsync_MultipleCollections_ExtractsEach`
- `ScanAsync_TargetCollections_OnlyExtractsSpecified`
- `ScanAsync_AutoDetectsCollections_WhenNoneSpecified`
- `ScanAsync_CalculatesCorrectMd5Hash`
- `ScanAsync_BytePositions_AreAccurate` (slice bytes back, verify JSON)
- `ScanAsync_EscapedQuotesInValues_DoesNotBreakParsing`
- `ScanAsync_UnicodeContent_HandledCorrectly`
- `ScanAsync_EmptyArray_ReturnsZeroObjects`
- `ScanAsync_ObjectAtByteZero_CapturedCorrectly`
- `ScanAsync_ObjectExceedsMaxSize_SkippedWithError`
- `ScanAsync_ContinueOnError_True_CollectsAllErrors`
- `ScanAsync_ContinueOnError_False_StopsOnFirstError`
- `ScanAsync_PropertyExtractor_InvokedForEachObject`
- `ScanAsync_IncludeJsonContent_PopulatesJsonContent`
- `ScanAsync_LargeFile_1000Objects_AllExtracted`
- `ScanAsync_ParallelProcessing_ProducesSameResultsAsSingleThreaded`
- `ScanAsync_FilePath_FileNotFound_ReturnsError`
- `ScanAsync_NestedObjectsInsideCollection_OnlyTopLevelExtracted`
- `ScanAsync_MultipleCollections_ItemIndexesArePerCollection`
- `ScanAsync_ValidateUtf8_InvalidBytes_ReturnsError`
- `ScanAsync_SkipStructureValidation_FasterForTrustedInput`

**JsonPathScannerTests.cs (~25 cases):**
- `ScanAsync_SingleLevelPath_ExtractsObjects`
- `ScanAsync_DeepNestedPath_ExtractsObjects`
- `ScanAsync_PathNotFound_ReturnsEmptyResult`
- `ScanAsync_CaseInsensitivePath_Matches`
- `ScanAsync_StrictMode_CaseSensitive`
- `ScanAsync_BytePositions_AccurateForPathExtraction`
- `ScanAsync_MultipleObjectsAtPath_AllExtracted`
- `ScanAsync_EmptyPath_ReturnsError`
- `ScanAsync_HashCalculation_CorrectForExtractedObjects`
- `ScanAsync_FilePath_Overload_Works`
- `ProcessStreamAsync_CallbackInvokedForEachObject`

**TrieTests.cs (~20 cases):**
- `Insert_And_SearchExact_ReturnsMatch`
- `Insert_And_SearchPrefix_ReturnsAllMatches`
- `Search_NoMatch_ReturnsEmpty`
- `Search_EmptyString_ReturnsEmpty`
- `Insert_DuplicateKeyword_BothReturned`
- `ContainsExact_ExistingKeyword_ReturnsTrue`
- `ContainsExact_NonExistingKeyword_ReturnsFalse`
- `Count_ReturnsCorrectTermCount`
- `TrieBuilder_Build_WithWordExtractor`
- `TrieBuilder_Build_LargeDataset_10kTerms`
- `Trie_Unicode_Keywords_InsertAndSearch`
- `Trie_CaseSensitivity_LowercaseOnly`

**ValidatorTests.cs (~15 cases):**
- `IsValidJsonStructure_ValidJson_ReturnsTrue`
- `IsValidJsonStructure_InvalidJson_ReturnsFalse`
- `IsValidJsonStructure_EmptyString_ReturnsFalse`
- `ValidateUtf8Safety_ValidAscii_NoException`
- `ValidateUtf8Safety_ValidMultibyteUtf8_NoException`
- `IsValidUtf8JsonDelimiter_ValidPosition_ReturnsTrue`
- `ValidateUtf8DelimiterSafety_ValidBytes_ReturnsTrue`

**IntegrationTests.cs (ETL pipeline scenarios):**
- `ETL_EcommerceFile_ScanAllCollections_VerifyCountsAndHashes`
- `ETL_CatalogFile_ExtractByPath_VerifyBytePositions`
- `ETL_ChainScanThenBuildTrie_SearchWorks`
- `ETL_ParallelScan_MatchesSequentialResults`
- `ETL_SemanticIndex_CastSearch_ReturnsCorrectObjects`
- `ETL_SemanticIndex_DescriptionPrefix_ReturnsMatches`
- `ETL_LargeFile_1000Objects_CompletesUnder500ms`

**FluentApiTests.cs:**
- `JsonTools_Scan_FluentChain_ProducesCorrectResult`
- `JsonTools_ExtractPath_FluentChain_ProducesCorrectResult`
- `JsonTools_BuildTrie_FluentChain_SearchWorks`
- `JsonTools_BuildSemanticIndex_SearchByField_Works`

**SemanticIndexTests.cs:**
- `SemanticIndex_BuildFromStream_IndexesConfiguredFields`
- `SemanticIndex_Search_ReturnsCorrectByteOffsets`
- `SemanticIndex_SearchObjects_ReturnsCorrectJsonStrings`
- `SemanticIndex_NGrams_EnabledAndSearchable`
- `SemanticIndex_MinWordLength_FiltersShortWords`
- `SemanticIndex_LargeDataset_MemoryStaysFlat`

[Implementation Order]
Numbered steps to minimize conflicts and ensure successful integration.

1. Add XML documentation to all existing public types/members (kills all 86 warnings, no behavior change)
2. Add `ParallelProcessing` and `SkipStructureValidation` to `JsonScanOptions`; add `SkipStructureValidation` to `JsonPathScanOptions`; add `ParallelWorkers` to `ScanMetadata`
3. Modify `GenericByteRangeScanner` to support parallel object processing via `Channel<T>` and fix buffer copy
4. Modify `GenericJsonPathScanner` to support `SkipStructureValidation`
5. Add `ContainsExact` to `Trie<T>`
6. Create `SemanticIndexOptions`, `JsonIndex`, `SemanticIndexBuilder`
7. Create `ScanBuilder`, `PathScanBuilder`, `JsonTools` (fluent API)
8. Create test project csproj and add to solution
9. Create test data fixtures (JSON files)
10. Write `ByteRangeScannerTests.cs`
11. Write `JsonPathScannerTests.cs`
12. Write `TrieTests.cs`
13. Write `ValidatorTests.cs`
14. Write `IntegrationTests.cs`
15. Write `FluentApiTests.cs`
16. Write `SemanticIndexTests.cs`
17. Run `dotnet test` — fix any failures
18. Run `dotnet build` — verify 0 errors, 0 warnings
19. Commit and push to GitHub
