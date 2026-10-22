using System.ComponentModel;
using System.Net.Http.Json;
using System.Text.Json;
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

        // The one tool that leaves the machine: translation runs on Workers AI behind mcp.bhasini.com.
        // BHASINI_TRANSLATE_URL points it at another deployment (e.g. `wrangler dev`). BHASINI_API_KEY
        // (from https://bhasini.com/api/) charges translations to that account instead of the free limits.
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };

        private static Uri TranslateUrl => new(Environment.GetEnvironmentVariable("BHASINI_TRANSLATE_URL") ?? "https://mcp.bhasini.com/v1/translate");

        [McpServerTool(Name = "translate", Title = "Translate text", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = true)]
        [Description("Translates the meaning of text between English and the 22 scheduled languages of India, or between two of them, e.g. 'Where is the station?' → 'स्टेशन कहाँ है?' (Hindi). " +
                     "English → Indic uses AI4Bharat IndicTrans2; Indic → English uses Gemma 4; Indic → Indic goes through English. Free use: up to 2,000 characters per call, 5 calls a minute and 10,000 characters a day. " +
                     "Unlike the other tools this sends the text to Bhasini's server (mcp.bhasini.com); the text is not stored. " +
                     "To write romanised words in a script by sound, use transliterate instead.")]
        public static async Task<string> Translate(
            [Description("Text to translate. Line breaks are kept.")] string text,
            [Description("Language to translate into: a code or name from list_languages, or 'en' for English.")] string targetLanguage,
            [Description("Language of the text, or 'auto' (default) to detect it.")] string sourceLanguage = "auto",
            CancellationToken cancellationToken = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, TranslateUrl)
            {
                Content = JsonContent.Create(new { text, source = sourceLanguage, target = targetLanguage }),
            };
            var apiKey = Environment.GetEnvironmentVariable("BHASINI_API_KEY");
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Authorization = new("Bearer", apiKey.Trim());
            using var response = await Http.SendAsync(request, cancellationToken);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            if (!response.IsSuccessStatusCode || !body.RootElement.TryGetProperty("translation", out var translation))
            {
                var error = body.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
                throw new McpException(error ?? $"Translation failed ({(int)response.StatusCode}).");
            }
            return translation.GetString() ?? "";
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
