# Performance Evidence

This repo now includes a benchmark harness so performance claims can be backed by repeatable measurements instead of only README prose and unit tests.

## What Exists Now

- correctness tests
- non-seekable streaming tests for the byte-range scanner
- non-seekable, tiny-buffer, and BOM tests for the path scanner
- a BenchmarkDotNet project at `benchmarks/JsonUtilities.Benchmarks`

## What To Measure

The most important questions are:

1. How fast is byte-range scanning when we collect all results?
2. How fast is the new bounded-memory callback path?
3. What is the cost of hashing?
4. How fast is streaming path extraction versus collect-all path extraction?
5. How expensive is semantic index build versus search?

## Run The Benchmarks

Run all benchmarks:

```bash
dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks
```

Run only the byte-range benchmarks:

```bash
dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*ByteRange*"
```

Run only the semantic benchmarks:

```bash
dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*Semantic*"
```

Run only the path benchmarks:

```bash
dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*Path*"
```

BenchmarkDotNet writes reports under `BenchmarkDotNet.Artifacts/`.

## How To Interpret Results

- `ScanAndCollectRanges` measures the compatibility path that still accumulates all matches into a `JsonScanResult`.
- `ScanIncrementally` measures the bounded-memory callback path exposed through `ProcessAsync(...)`.
- `ScanIncrementallyWithHashes` shows the cost of MD5 work on top of scanning.
- `ScanPathAndCollect` measures dot-notation path extraction when the full `JsonPathScanResult` is built in memory.
- `ProcessPathIncrementally` measures the bounded-memory callback path for path extraction.
- `ProcessPathIncrementallyWithHashes` shows the cost of hash work during streaming path extraction.
- `BuildIndex` measures semantic index construction.
- `SearchOffsets` and `SearchObjects` separate index lookup from object materialization.

## Latest Local Sample

Short-run byte-range benchmarks were executed locally on March 29, 2026 on this machine:

- Apple M4
- .NET 8.0.25 runtime
- BenchmarkDotNet `ShortRun`

Headline results from `dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*ByteRange*"`:

| Scenario | 1,000 items | 10,000 items |
|---|---:|---:|
| `ScanAndCollectRanges` | 1.129 ms | 12.612 ms |
| `ScanIncrementally` | 1.068 ms | 11.090 ms |
| `ScanIncrementallyWithHashes` | 1.144 ms | 12.557 ms |

What that means:

- the new incremental callback path is already slightly faster than the collect-all path in this local run
- hashing adds measurable cost, but it is not catastrophic on this dataset
- the managed allocation difference is small for this synthetic benchmark, but the incremental path sharply reduces higher-generation GC activity in the 10,000-item case

The generated BenchmarkDotNet reports are written to `BenchmarkDotNet.Artifacts/results/`.

Semantic short-run sample from `dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*Semantic*"` after moving semantic build onto the streaming scanner path, fixing exact-key trie insertion, letting the builder parse directly from UTF-8 bytes, vectorizing separator scans in the tokenizer, and fixing UTF-8-safe object materialization:

| Scenario | 1,000 items | 10,000 items |
|---|---:|---:|
| `BuildIndex` | 4.818 ms | 55.986 ms |
| `SearchOffsets` | 8.706 us | 164.195 us |
| `SearchObjects` | 240.699 us | 2.474 ms |

What that means:

- semantic search lookup is fast once the index already exists
- semantic object materialization is still a separate cost from index construction, but it is now both UTF-8-correct and faster than the prior local sample
- semantic index construction is no longer the runaway hotspot it was earlier in this work
- the big win came from five cumulative changes:
  1. semantic build now walks objects incrementally through the byte-range scanner callback path
  2. `JsonIndex` now performs exact-key trie insertions instead of using prefix search during index build
  3. the scanner no longer copies buffered object bytes into a second array before processing
  4. semantic build now parses `JsonDocument` directly from UTF-8 bytes instead of round-tripping through a managed string
  5. semantic tokenization now uses vectorized separator scans instead of split-heavy string processing

The object-materialization path also got a correctness fix in this pass:

- `SearchObjects(...)` now buffers raw UTF-8 bytes and decodes once at the end, so non-ASCII content survives round-trips from indexed offsets back into JSON strings

Before/after headline deltas from local runs on this machine:

| Metric | Earlier run | Latest run |
|---|---:|---:|
| `BuildIndex` 1,000 items | 20.109 ms | 4.818 ms |
| `BuildIndex` 10,000 items | 1.529 s | 55.986 ms |
| `SearchObjects` 1,000 items | 314.113 us | 240.699 us |
| `SearchObjects` 10,000 items | 3.119 ms | 2.474 ms |
| Managed allocation 1,000 items | 36,665.94 KB | 4,573.75 KB |
| Managed allocation 10,000 items | 2,820,715.22 KB | 46,550.04 KB |

Path short-run sample from `dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*Path*"` after refactoring `GenericJsonPathScanner` to parse incrementally:

| Scenario | 1,000 items | 10,000 items |
|---|---:|---:|
| `ScanPathAndCollect` | 967.485 us | 11.130 ms |
| `ProcessPathIncrementally` | 921.470 us | 9.264 ms |
| `ProcessPathIncrementallyWithHashes` | 852.426 us | 8.853 ms |

What that means:

- path extraction now has a real chunked-streaming implementation instead of preloading the full source into memory
- the incremental path is modestly faster than the collect-all path in this local run
- the hash-enabled run also came in slightly faster here, which is best treated as short-run noise rather than proof that hashing is free
- more importantly, the GC profile improved: the incremental path drops Gen1/Gen2 pressure at 10,000 items
- the path scanner now explicitly handles non-seekable streams, tiny chunk boundaries, and UTF-8 BOM-prefixed files

## What This Does And Does Not Prove

This harness is meant to prove relative performance and allocation behavior on representative datasets.

It does **not** magically prove:

- peak RSS on every machine
- behavior for every JSON shape
- that every semantic indexing workload is already larger-than-RAM safe

## Current Honest Bottom Line

- Byte-range scanning now has a real streaming callback path and tests for non-seekable streams.
- Path scanning now has a real chunked-streaming implementation, plus coverage for non-seekable streams, tiny buffers, and BOM-prefixed input.
- Semantic index construction now uses that streaming callback path and is materially faster and lighter than earlier revisions.

That means the library’s core scan paths are now much easier to defend than they were at the start of this work.

## Highest-Leverage Next Optimizations

If more performance work is needed, these are the best next targets:

1. Remove per-object allocation overhead in the incremental scanner paths.
The current callback path still constructs a `JsonObjectRange` object for every match, and the parallel path also allocates work items.

2. Add a larger benchmark tier.
The current harness covers 1,000 and 10,000 items. A 50,000 or 100,000 item profile would make scaling behavior much easier to talk about with confidence.

3. Capture peak-process memory, not only managed allocation totals.
BenchmarkDotNet is great for time and managed allocations, but a separate probe for peak RSS would better support the “works beyond RAM pressure” story.

4. Measure object-materialization paths separately from raw scan speed.
`SearchObjects(...)` and `IncludeJsonContent = true` still allocate by design, so they deserve their own budget and expectations.

5. Reduce object-materialization churn when callers need full JSON strings.
`SearchObjects(...)` now preserves UTF-8 correctly and is faster than before, but it still allocates because it is intentionally materializing JSON content.
