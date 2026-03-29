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

## What This Does And Does Not Prove

This harness is meant to prove relative performance and allocation behavior on representative datasets.

It does **not** magically prove:

- peak RSS on every machine
- behavior for every JSON shape
- that path scanning is fully streaming
- that semantic index construction is already larger-than-RAM safe

## Current Honest Bottom Line

- Byte-range scanning now has a real streaming callback path and tests for non-seekable streams.
- Path scanning still buffers the full stream today.
- Semantic index build still depends on the non-streaming path scanner underneath its current implementation.

That means the byte-range performance story is now much easier to defend than the rest of the library.
