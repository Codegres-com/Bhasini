using System.ComponentModel;
using Bhasini.Core.Languages;
using Bhasini.Core.Scripts;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Bhasini.Mcp
{
    [McpServerToolType]
    public static class IndicTools
    {
        public sealed record LanguageInfo(string Code, string Name, string NativeName, string Script, bool RightToLeft, bool InScript, bool ScriptConversionTarget, string Example);

        public sealed record KeyEntry(string Keys, string Output, string? Note);

        public sealed record KeyGroup(string Title, IReadOnlyList<KeyEntry> Entries);

        [McpServerTool(Name = "list_languages", Title = "List Indian languages", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
        [Description("Lists the 22 scheduled languages of India (plus extra official scripts for Kashmiri, Manipuri and Sindhi) with the codes the other tools accept.")]
        public static IReadOnlyList<LanguageInfo> ListLanguages() =>
            LanguageCatalog.All.Where(l => !l.IsEnglish)
                .Select(l => new LanguageInfo(l.Code, l.Name, l.NativeName, l.ScriptName, l.RightToLeft, l.SupportsInscript,
                    ScriptConverter.CanConvertTo(l), $"{l.SampleInput} → {l.Sample}"))
                .ToList();

        [McpServerTool(Name = "transliterate", Title = "Transliterate romanised text", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
        [Description("Writes romanised (Latin-letter) text in an Indian script by sound, e.g. 'namaste' → 'नमस्ते' for Hindi or 'vaNakkam' → 'வணக்கம்' for Tamil. " +
                     "This is transliteration, not translation: spell the words as they sound in the target language. " +
                     "Keys follow ITRANS/Baraha conventions: capitals for long vowels and retroflex consonants (A I U E O, T D N L Sh), M = anusvara, H = visarga. " +
                     "Use get_keymap for a language's exact keys.")]
        public static string Transliterate(
            [Description("Romanised text to transliterate. Punctuation, digits and spaces are kept.")] string text,
            [Description("Target language code or name, e.g. 'hi', 'ta', 'kn', 'Bengali', 'sat' (Santali, Ol Chiki).")] string language) =>
            ScriptConverter.FromRoman(text, Find(language));

        [McpServerTool(Name = "convert_script", Title = "Convert between Indian scripts", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
        [Description("Rewrites text from one Indian script into another letter by letter, e.g. Devanagari 'नमस्ते' → Kannada 'ನಮಸ್ತೇ'. " +
                     "The language does not change, only the letters. Works between the Brahmic scripts (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam) and Meetei Mayek; " +
                     "sounds the target script lacks use the nearest letter. Text in other scripts is kept as it is.")]
        public static string ConvertScript(
            [Description("Text in any Brahmic script or Meetei Mayek.")] string text,
            [Description("Language whose script to convert into, e.g. 'ta', 'Telugu', 'mni'.")] string targetLanguage)
        {
            var target = Find(targetLanguage);
            if (!ScriptConverter.CanConvertTo(target))
            {
                throw new McpException($"{target.Name} ({target.ScriptName}) is not a script conversion target. Use transliterate with romanised text instead.");
            }
            return ScriptConverter.ConvertScript(text, target);
        }

        [McpServerTool(Name = "get_keymap", Title = "Get phonetic keyboard map", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
        [Description("Returns the phonetic keyboard map for a language: which Latin keys produce each letter. Useful for teaching someone to type a language or for building correct romanised input for transliterate.")]
        public static IReadOnlyList<KeyGroup> GetKeymap(
            [Description("Language code or name, e.g. 'ml', 'Odia'.")] string language) =>
            Find(language).Phonetic!.Keymap
                .Select(g => new KeyGroup(g.Title, g.Entries.Select(e => new KeyEntry(e.Keys, e.Output, e.Note)).ToList()))
                .ToList();

        [McpServerTool(Name = "native_digits", Title = "Write digits in a native script", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false)]
        [Description("Replaces ASCII digits 0-9 with a language's native digits, e.g. '2026' → '२०२६' (Hindi), '௨௦௨௬' (Tamil), '۲۰۲۶' (Urdu).")]
        public static string NativeDigits(
            [Description("Text containing digits.")] string text,
            [Description("Language code or name.")] string language)
        {
            var target = Find(language);
            if (target.DigitMapper == null) throw new McpException($"{target.Name} has no native digits.");
            return string.Concat(text.Select(c => c is >= '0' and <= '9' ? target.DigitMapper(c - '0') : c));
        }

        // Unlike LanguageCatalog.Get, an unknown language is an error rather than Hindi.
        private static IndicLanguage Find(string language)
        {
            var key = language.Trim();
            var match = LanguageCatalog.All.FirstOrDefault(l => !l.IsEnglish &&
                (string.Equals(l.Code, key, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(l.Name, key, StringComparison.OrdinalIgnoreCase) ||
                 l.NativeName == key));
            return match ?? throw new McpException($"Unknown language '{language}'. Call list_languages for the supported codes.");
        }
    }
}
