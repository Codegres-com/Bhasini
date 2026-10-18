namespace Bhasini.Core.Input
{
    // Turns the Latin keys of the word being typed into text in a language's script.
    // The whole word is re-rendered on every key, so multi-letter sequences ("kh", "aa", "ksh")
    // and context rules (word-final forms) need no special keystroke bookkeeping.
    public interface ITransliterator
    {
        bool IsWordChar(char c);

        string Render(string latinWord);

        IReadOnlyList<KeymapGroup> Keymap { get; }
    }

    public sealed record KeymapEntry(string Keys, string Output, string? Note = null);

    public sealed record KeymapGroup(string Title, IReadOnlyList<KeymapEntry> Entries);
}
