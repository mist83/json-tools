# Performance Evidence

This repo now includes a benchmark harness so performance claims can be backed by repeatable measurements instead of only README prose and unit tests.

## What Exists Now

- correctness tests
- non-seekable streaming tests for the byte-range scanner
- a BenchmarkDotNet project at `benchmarks/JsonUtilities.Benchmarks`

## What To Measure

The most important questions are:

1. How fast is byte-range scanning when we collect all results?
2. How fast is the new bounded-memory callback path?
3. What is the cost of hashing?
4. How expensive is semantic index build versus search?

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

BenchmarkDotNet writes reports under `BenchmarkDotNet.Artifacts/`.

## How To Interpret Results

- `ScanAndCollectRanges` measures the compatibility path that still accumulates all matches into a `JsonScanResult`.
- `ScanIncrementally` measures the bounded-memory callback path exposed through `ProcessAsync(...)`.
- `ScanIncrementallyWithHashes` shows the cost of MD5 work on top of scanning.
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

Semantic short-run sample from `dotnet run -c Release --project benchmarks/JsonUtilities.Benchmarks -- --filter "*Semantic*"` after moving semantic build onto the streaming scanner path and fixing exact-key trie insertion:

| Scenario | 1,000 items | 10,000 items |
|---|---:|---:|
| `BuildIndex` | 10.257 ms | 79.188 ms |
| `SearchOffsets` | 9.880 us | 143.311 us |
| `SearchObjects` | 371.653 us | 3.438 ms |

What that means:

- semantic search lookup is fast once the index already exists
- semantic object materialization is still reasonable on this synthetic dataset, but it is not the same thing as index construction
- semantic index construction is no longer the runaway hotspot it was earlier in this work
- the big win came from two changes:
  1. semantic build now walks objects incrementally through the byte-range scanner callback path
  2. `JsonIndex` now performs exact-key trie insertions instead of using prefix search during index build

Before/after headline deltas from local runs on this machine:

| Metric | Earlier run | Latest run |
|---|---:|---:|
| `BuildIndex` 1,000 items | 20.109 ms | 10.257 ms |
| `BuildIndex` 10,000 items | 1.529 s | 79.188 ms |
| Managed allocation 1,000 items | 36,665.94 KB | 6,204.36 KB |
| Managed allocation 10,000 items | 2,820,715.22 KB | 63,016.31 KB |

## What This Does And Does Not Prove

This harness is meant to prove relative performance and allocation behavior on representative datasets.

It does **not** magically prove:

- peak RSS on every machine
- behavior for every JSON shape
- that path scanning is fully streaming
- that every semantic indexing workload is already larger-than-RAM safe

## Current Honest Bottom Line

- Byte-range scanning now has a real streaming callback path and tests for non-seekable streams.
- Semantic index construction now uses that streaming callback path and is materially faster and lighter than earlier revisions.
- Path scanning still buffers the full stream today.

That means the byte-range and semantic-index stories are now much easier to defend than the path-scanning story.

## Highest-Leverage Next Optimizations

If more performance work is needed, these are the best next targets:

1. Make path scanning truly streaming.
`GenericJsonPathScanner` still buffers the entire stream, which limits the broader “larger-than-RAM” story.

2. Remove per-object allocation overhead in the incremental scanner path.
The current callback path still constructs a `JsonObjectRange` object for every match, and the parallel path also allocates work items.

3. Let semantic build consume raw UTF-8 object bytes.
Today semantic build still parses from `JsonObjectRange.JsonContent`, which means each indexed object is first materialized as a managed string.

4. Add a larger benchmark tier.
The current harness covers 1,000 and 10,000 items. A 50,000 or 100,000 item profile would make scaling behavior much easier to talk about with confidence.

5. Capture peak-process memory, not only managed allocation totals.
BenchmarkDotNet is great for time and managed allocations, but a separate probe for peak RSS would better support the “works beyond RAM pressure” story.
