using System;
using FluentAssertions;
using Xunit;

namespace JsonUtilities.Tests;

public class ValidatorTests
{
    private readonly JsonValidator _validator = new();

    [Fact] public void IsValidJsonStructure_ValidObject_ReturnsTrue() =>
        _validator.IsValidJsonStructure("{\"key\":\"value\"}").Should().BeTrue();

    [Fact] public void IsValidJsonStructure_ValidArray_ReturnsTrue() =>
        _validator.IsValidJsonStructure("[1,2,3]").Should().BeTrue();

    [Fact] public void IsValidJsonStructure_InvalidJson_ReturnsFalse() =>
        _validator.IsValidJsonStructure("{bad json}").Should().BeFalse();

    [Fact] public void IsValidJsonStructure_EmptyString_ReturnsFalse() =>
        _validator.IsValidJsonStructure("").Should().BeFalse();

    [Fact] public void IsValidJsonStructure_WhitespaceOnly_ReturnsFalse() =>
        _validator.IsValidJsonStructure("   ").Should().BeFalse();

    [Fact] public void IsValidJsonStructure_UnclosedBrace_ReturnsFalse() =>
        _validator.IsValidJsonStructure("{\"key\":\"value\"").Should().BeFalse();

    [Fact] public void IsValidJsonStructure_NestedObject_ReturnsTrue() =>
        _validator.IsValidJsonStructure("{\"a\":{\"b\":{\"c\":1}}}").Should().BeTrue();

    [Fact] public void ValidateUtf8Safety_ValidAscii_DoesNotThrow()
    {
        var act = () => _validator.ValidateUtf8Safety("{\"name\":\"hello world\"}");
        act.Should().NotThrow();
    }

    [Fact] public void ValidateUtf8Safety_EmptyString_DoesNotThrow()
    {
        var act = () => _validator.ValidateUtf8Safety("");
        act.Should().NotThrow();
    }

    [Fact] public void ValidateUtf8Safety_ValidUnicode_DoesNotThrow()
    {
        var act = () => _validator.ValidateUtf8Safety("{\"name\":\"日本語\"}");
        act.Should().NotThrow();
    }

    [Fact] public void IsValidUtf8JsonDelimiter_NullBytes_ReturnsFalse() =>
        _validator.IsValidUtf8JsonDelimiter(null!, 0).Should().BeFalse();

    [Fact] public void IsValidUtf8JsonDelimiter_NegativePosition_ReturnsFalse() =>
        _validator.IsValidUtf8JsonDelimiter(new byte[] { 123 }, -1).Should().BeFalse();

    [Fact] public void IsValidUtf8JsonDelimiter_PositionBeyondLength_ReturnsFalse() =>
        _validator.IsValidUtf8JsonDelimiter(new byte[] { 123 }, 5).Should().BeFalse();

    [Fact] public void IsValidUtf8JsonDelimiter_NonDelimiterByte_ReturnsTrue() =>
        _validator.IsValidUtf8JsonDelimiter(new byte[] { 65 }, 0).Should().BeTrue(); // 'A'

    [Fact] public void ValidateUtf8DelimiterSafety_NullBytes_ReturnsFalse() =>
        _validator.ValidateUtf8DelimiterSafety(null!).Should().BeFalse();

    [Fact] public void ValidateUtf8DelimiterSafety_EmptyBytes_ReturnsFalse() =>
        _validator.ValidateUtf8DelimiterSafety([]).Should().BeFalse();

    [Fact] public void ValidateUtf8DelimiterSafety_NonDelimiterLastByte_ReturnsTrue() =>
        _validator.ValidateUtf8DelimiterSafety(new byte[] { 65, 66, 67 }).Should().BeTrue(); // "ABC"
}
