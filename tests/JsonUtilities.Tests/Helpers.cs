using System.IO;
using System.Text;

namespace JsonUtilities.Tests;

/// <summary>Shared test helpers for creating streams and loading fixtures.</summary>
internal static class Helpers
{
    public static Stream ToStream(string json) =>
        new MemoryStream(Encoding.UTF8.GetBytes(json));

    public static Stream ToNonSeekableStream(string json, int chunkSize = 7) =>
        new NonSeekableChunkedStream(Encoding.UTF8.GetBytes(json), chunkSize);

    public static Stream LoadFixture(string filename) =>
        File.OpenRead(Path.Combine("TestData", filename));

    public static string FixturePath(string filename) =>
        Path.Combine("TestData", filename);

    public static string LoadFixtureText(string filename) =>
        File.ReadAllText(Path.Combine("TestData", filename));

    private sealed class NonSeekableChunkedStream : Stream
    {
        private readonly byte[] _data;
        private readonly int _chunkSize;
        private int _position;

        public NonSeekableChunkedStream(byte[] data, int chunkSize)
        {
            _data = data;
            _chunkSize = chunkSize;
        }

        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override void Flush()
        {
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            var remaining = _data.Length - _position;
            if (remaining <= 0) return 0;

            var bytesToCopy = Math.Min(Math.Min(count, _chunkSize), remaining);
            Buffer.BlockCopy(_data, _position, buffer, offset, bytesToCopy);
            _position += bytesToCopy;
            return bytesToCopy;
        }

        public override int Read(Span<byte> buffer)
        {
            var remaining = _data.Length - _position;
            if (remaining <= 0) return 0;

            var bytesToCopy = Math.Min(Math.Min(buffer.Length, _chunkSize), remaining);
            _data.AsSpan(_position, bytesToCopy).CopyTo(buffer);
            _position += bytesToCopy;
            return bytesToCopy;
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
