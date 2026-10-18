using Bhasini.Core.Input;
using Bhasini.Core.Scripts;

namespace Bhasini.Core.Languages
{
    public sealed class IndicLanguage
    {
        public required string Code { get; init; }

        public required string Name { get; init; }

        public required string NativeName { get; init; }

        public required Script Script { get; init; }

        public required string ScriptName { get; init; }

        // Year the language entered the Eighth Schedule of the Constitution; null for English.
        public int? ScheduledSince { get; init; }

        // Null for English: keys pass straight through.
        public ITransliterator? Phonetic { get; init; }

        // Set for Brahmic scripts: enables InScript typing and script conversion.
        public IScriptMapper? Mapper { get; init; }

        public string? SpeechLocale { get; init; }

        public bool RightToLeft { get; init; }

        public required string FontClass { get; init; }

        // Romanised sample shown in the UI ("namaste").
        public string SampleInput { get; init; } = "";

        public IReadOnlyDictionary<char, string> Punctuation { get; init; } = new Dictionary<char, string>();

        public Func<int, char>? DigitMapper { get; init; }

        public bool IsEnglish => Phonetic == null;

        public bool SupportsInscript => Mapper is OffsetScriptMapper;

        public string Sample => Phonetic == null || SampleInput.Length == 0
            ? SampleInput
            : string.Join(" ", SampleInput.Split(' ').Select(Phonetic.Render));

        public char? NativeDigit(int d) => DigitMapper?.Invoke(d);
    }
}
