using System.IO;
using System.Text;

namespace JsonUtilities.Tests;

/// <summary>Shared test helpers for creating streams and loading fixtures.</summary>
internal static class Helpers
{
    public static Stream ToStream(string json) =>
        new MemoryStream(Encoding.UTF8.GetBytes(json));

    public static Stream LoadFixture(string filename) =>
        File.OpenRead(Path.Combine("TestData", filename));

    public static string FixturePath(string filename) =>
        Path.Combine("TestData", filename);

    public static string LoadFixtureText(string filename) =>
        File.ReadAllText(Path.Combine("TestData", filename));
}
