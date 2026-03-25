using System;
using System.Buffers;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text;

namespace JsonUtilities;

/// <summary>
/// Synchronous streaming JSON path indexer.
/// Processes a stream and invokes a callback for each object found at the given path.
/// Uses ArrayPool for buffer management.
/// </summary>
public class JsonStreamIndexer
{
    private readonly string[] _targetPathSegments;

    /// <summary>
    /// Initializes a new <see cref="JsonStreamIndexer"/> for the specified dot-notation JSON path.
    /// </summary>
    /// <param name="jsonPath">Dot-notation path to the target array (e.g. <c>company.departments.employees</c>).</param>
    /// <exception cref="System.ArgumentException">Thrown when <paramref name="jsonPath"/> is null or whitespace.</exception>
    public JsonStreamIndexer(string jsonPath)
    {
        if (string.IsNullOrWhiteSpace(jsonPath))
            throw new ArgumentException("JSON path cannot be empty.", nameof(jsonPath));

        _targetPathSegments = jsonPath.Split('.');
        for (int i = 0; i < _targetPathSegments.Length; i++)
            _targetPathSegments[i] = _targetPathSegments[i].ToLowerInvariant();
    }

    /// <summary>
    /// Process a stream, invoking <paramref name="processJson"/> for each object found.
    /// Callback receives (startByteOffset, endByteOffset, jsonText).
    /// </summary>
    public void ProcessStream(Stream stream, Action<long, long, string> processJson)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, -1, leaveOpen: true);
        long byteOffset = 0;

        if (!FindJsonPath(reader, ref byteOffset))
        {
            Console.WriteLine("Target JSON path not found.");
            return;
        }

        ExtractJsonObjects(reader, stream, processJson, ref byteOffset);
    }

    private bool FindJsonPath(StreamReader reader, ref long byteOffset)
    {
        int depth = 0;
        bool inQuote = false;
        var sb = new StringBuilder(64);

        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;

            if (c == '"')
            {
                inQuote = !inQuote;
                if (inQuote) continue;

                if (sb.ToString().ToLowerInvariant() == _targetPathSegments[depth])
                {
                    depth++;
                    if (depth == _targetPathSegments.Length)
                        return SeekToArray(reader, ref byteOffset);
                }
                sb.Clear();
            }
            else if (inQuote)
            {
                sb.Append(c);
            }
        }
        return false;
    }

    private static bool SeekToArray(StreamReader reader, ref long byteOffset)
    {
        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '[') return true;
            if (c == '{') SkipObject(reader, ref byteOffset);
        }
        return false;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static void SkipObject(StreamReader reader, ref long byteOffset)
    {
        int depth = 1;
        while (!reader.EndOfStream && depth > 0)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '{') depth++;
            else if (c == '}') depth--;
        }
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static void SkipArray(StreamReader reader, ref long byteOffset)
    {
        int depth = 1;
        while (!reader.EndOfStream && depth > 0)
        {
            char c = (char)reader.Read();
            byteOffset++;
            if (c == '[') depth++;
            else if (c == ']') depth--;
        }
    }

    private static void ExtractJsonObjects(StreamReader reader, Stream baseStream,
        Action<long, long, string> processJson, ref long byteOffset)
    {
        long startPos = 0;
        int depth = 0;
        bool inObject = false;

        while (!reader.EndOfStream)
        {
            char c = (char)reader.Read();
            byteOffset++;

            if (char.IsWhiteSpace(c)) continue;
            if (!inObject && c == ']') break;

            if (!inObject && c == '{')
            {
                startPos = byteOffset - 1;
                depth = 1;
                inObject = true;
                continue;
            }

            if (!inObject) continue;

            if (c == '{') depth++;
            else if (c == '}') depth--;

            if (depth != 0) continue;

            long endPos = byteOffset;
            int objLen = (int)(endPos - startPos);

            byte[] buf = ArrayPool<byte>.Shared.Rent(objLen);
            try
            {
                baseStream.Seek(startPos, SeekOrigin.Begin);
                baseStream.Read(buf, 0, objLen);
                string json = Encoding.UTF8.GetString(buf, 0, objLen);
                processJson(startPos, endPos, json);
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buf);
            }

            inObject = false;
            depth = 0;

            while (!reader.EndOfStream)
            {
                c = (char)reader.Read();
                byteOffset++;
                if (char.IsWhiteSpace(c) || c == ',') continue;
                if (c == ']') return;
                if (c == '{')
                {
                    startPos = byteOffset - 1;
                    depth = 1;
                    inObject = true;
                    break;
                }
            }
        }
    }
}
