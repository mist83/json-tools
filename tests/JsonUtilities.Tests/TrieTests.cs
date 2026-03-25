using System.Linq;
using FluentAssertions;
using JsonUtilities.Indexing;
using Xunit;

namespace JsonUtilities.Tests;

public class TrieTests
{
    private static Trie<string> BuildTrie(params (string keyword, string datum)[] entries)
    {
        var trie = new Trie<string>();
        foreach (var (k, d) in entries)
            trie.Insert(new NodeDataPointer<string> { Keyword = k, Datum = d });
        return trie;
    }

    [Fact] public void Insert_And_SearchExact_ReturnsMatch()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.Search("javascript").Should().ContainSingle().Which.Should().Be("JavaScript");
    }

    [Fact] public void Insert_And_SearchPrefix_ReturnsAllMatches()
    {
        var trie = BuildTrie(("javascript", "JavaScript"), ("java", "Java"), ("python", "Python"));
        var results = trie.Search("java");
        results.Should().HaveCount(2);
        results.Should().Contain("JavaScript");
        results.Should().Contain("Java");
    }

    [Fact] public void Search_NoMatch_ReturnsEmpty()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.Search("ruby").Should().BeEmpty();
    }

    [Fact] public void Search_EmptyString_ReturnsEmpty()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.Search("").Should().BeEmpty();
    }

    [Fact] public void Insert_DuplicateKeyword_BothReturned()
    {
        var trie = BuildTrie(("java", "Java SE"), ("java", "Java EE"));
        trie.Search("java").Should().HaveCount(2);
    }

    [Fact] public void ContainsExact_ExistingKeyword_ReturnsTrue()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.ContainsExact("javascript").Should().BeTrue();
    }

    [Fact] public void ContainsExact_PrefixOnly_ReturnsFalse()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.ContainsExact("java").Should().BeFalse();
    }

    [Fact] public void ContainsExact_NonExistingKeyword_ReturnsFalse()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.ContainsExact("ruby").Should().BeFalse();
    }

    [Fact] public void ContainsExact_EmptyString_ReturnsFalse()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.ContainsExact("").Should().BeFalse();
    }

    [Fact] public void Count_ReturnsCorrectTermCount()
    {
        var trie = BuildTrie(("a", "A"), ("b", "B"), ("c", "C"), ("ab", "AB"));
        trie.Count().Should().Be(4);
    }

    [Fact] public void Count_EmptyTrie_ReturnsZero()
    {
        new Trie<string>().Count().Should().Be(0);
    }

    [Fact] public void TrieBuilder_Build_WithWordExtractor()
    {
        var items = new[] { "Hello World", "Hello There", "Goodbye" };
        var trie = new TrieBuilder<string>().Build(items, s => s.ToLower().Split(' '));
        trie.Search("hello").Should().HaveCount(2);
        trie.Search("goodbye").Should().ContainSingle();
    }

    [Fact] public void TrieBuilder_Build_LargeDataset_10kTerms()
    {
        var items = Enumerable.Range(1, 10000).Select(i => $"term{i}").ToList();
        var trie = new TrieBuilder<string>().Build(items, s => new[] { s });
        trie.Count().Should().Be(10000);
        trie.Search("term1").Length.Should().BeGreaterThan(0);
        trie.ContainsExact("term5000").Should().BeTrue();
    }

    [Fact] public void Trie_Unicode_Keywords_InsertAndSearch()
    {
        var trie = BuildTrie(("日本語", "Japanese"), ("中文", "Chinese"));
        trie.Search("日本語").Should().ContainSingle().Which.Should().Be("Japanese");
    }

    [Fact] public void Trie_CaseSensitivity_LowercaseOnly()
    {
        var trie = BuildTrie(("javascript", "JavaScript"));
        trie.Search("JavaScript").Should().BeEmpty(); // case-sensitive
        trie.Search("javascript").Should().ContainSingle();
    }

    [Fact] public void Search_SingleCharPrefix_ReturnsAllStartingWithChar()
    {
        var trie = BuildTrie(("apple", "Apple"), ("apricot", "Apricot"), ("banana", "Banana"));
        trie.Search("a").Should().HaveCount(2);
    }

    [Fact] public void Insert_EmptyKeyword_IsIgnored()
    {
        var trie = new Trie<string>();
        trie.Insert(new NodeDataPointer<string> { Keyword = "", Datum = "empty" });
        trie.Count().Should().Be(0);
    }
}
