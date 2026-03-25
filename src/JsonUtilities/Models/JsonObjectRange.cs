using System.Collections.Generic;

namespace JsonUtilities.Models;

/// <summary>
/// Represents the byte-range location and metadata of a single JSON object found during scanning.
/// Use <see cref="StartPosition"/> and <see cref="Length"/> to perform targeted reads from the source file
/// without loading the entire file into memory.
/// </summary>
public class JsonObjectRange
{
    /// <summary>Gets or sets the zero-based byte offset where this object begins in the source stream.</summary>
    public long StartPosition { get; set; }

    /// <summary>Gets or sets the length in bytes of this JSON object.</summary>
    public long Length { get; set; }

    /// <summary>Gets or sets an optional type discriminator for this object (e.g. collection name).</summary>
    public string? ObjectType { get; set; }

    /// <summary>Gets or sets the MD5 hex hash of the object's raw bytes. Populated when <see cref="JsonScanOptions.CalculateHashes"/> is <c>true</c>.</summary>
    public string? Hash { get; set; }

    /// <summary>Gets or sets a dictionary of extracted properties. Populated when <see cref="JsonScanOptions.PropertyExtractor"/> is set.</summary>
    public Dictionary<string, object>? Properties { get; set; }

    /// <summary>Gets or sets the raw JSON text of this object. Populated when <see cref="JsonScanOptions.IncludeJsonContent"/> is <c>true</c>.</summary>
    public string? JsonContent { get; set; }

    /// <summary>Gets or sets the zero-based index of this object within its collection.</summary>
    public int ItemIndex { get; set; }

    /// <summary>Gets or sets an error message if this object failed processing. <c>null</c> when successful.</summary>
    public string? Error { get; set; }

    /// <summary>Gets the exclusive end byte position (<see cref="StartPosition"/> + <see cref="Length"/>).</summary>
    public long EndPosition => StartPosition + Length;
}
