using Bhasini.Core.Languages;

namespace Bhasini.Web.Site
{
    public enum SitePageKind { Typing, EnglishTo, Keyboard, VoiceTyping, ScriptConverter }

    // A landing page for one search intent ("hindi typing", "english to tamil typing", "kannada keyboard").
    // The site generator (tools/Bhasini.SiteGen) writes /<slug>/index.html for each one, and the editor
    // opens in the page's language when it loads there.
    public sealed record SitePage(string Slug, SitePageKind Kind, IndicLanguage? Language, string Title, string Description)
    {
        public string Path => "/" + Slug + "/";

        // The keyboard pages open with the key map showing.
        public bool ShowKeymap => Kind == SitePageKind.Keyboard;
    }

    public static class SitePages
    {
        // Languages with a separate high-volume "english to X typing" search.
        private static readonly string[] EnglishToCodes = { "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa", "or", "ur", "sa", "ne", "as" };

        // One page per language, not per script: the other official scripts are covered on the same page.
        public static IEnumerable<IndicLanguage> Languages => LanguageCatalog.All.Where(l => !l.IsEnglish && !l.Code.Contains('-'));

        public static string LanguageSlug(IndicLanguage language) => language.Name.ToLowerInvariant();

        public static IReadOnlyList<SitePage> All { get; } = Build();

        private static List<SitePage> Build()
        {
            var pages = new List<SitePage>();
            foreach (var l in Languages)
            {
                var s = LanguageSlug(l);
                pages.Add(new SitePage($"{s}-typing", SitePageKind.Typing, l,
                    $"{l.Name} Typing Online — Free {l.Name} Keyboard | Bhasini",
                    $"Type in {l.Name} ({l.NativeName}) online for free. Phonetic{(l.SupportsInscript ? " and InScript" : "")} keyboard for the {l.ScriptName} script, no install needed. Copy, or save as Word (.docx)."));
            }
            foreach (var code in EnglishToCodes)
            {
                var l = LanguageCatalog.Get(code);
                var s = LanguageSlug(l);
                pages.Add(new SitePage($"english-to-{s}-typing", SitePageKind.EnglishTo, l,
                    $"English to {l.Name} Typing — Type {l.Name} in English Letters | Bhasini",
                    $"Type {l.Name} words in English letters and get {l.ScriptName} script instantly: \"{l.SampleInput}\" becomes {l.Sample}. Free English to {l.Name} transliteration online."));
            }
            foreach (var l in Languages)
            {
                var s = LanguageSlug(l);
                pages.Add(new SitePage($"{s}-keyboard", SitePageKind.Keyboard, l,
                    $"{l.Name} Keyboard — {(l.SupportsInscript ? "Phonetic & InScript Layout" : "Phonetic Key Chart")} | Bhasini",
                    $"Online {l.Name} keyboard with the full {l.ScriptName} key chart{(l.SupportsInscript ? " for phonetic and InScript layouts" : "")}. Tap letters or type on your own keyboard. Free, works on phone and PC."));
            }
            foreach (var l in Languages.Where(l => l.SpeechLocale != null))
            {
                var s = LanguageSlug(l);
                pages.Add(new SitePage($"{s}-voice-typing", SitePageKind.VoiceTyping, l,
                    $"{l.Name} Voice Typing Online — Speak to Type {l.Name} | Bhasini",
                    $"Speak and type in {l.Name} ({l.NativeName}) for free in Chrome or Edge. Fix words with the {l.Name} keyboard, then copy or save as Word."));
            }
            pages.Add(new SitePage("indian-script-converter", SitePageKind.ScriptConverter, null,
                "Indian Script Converter — Convert Hindi, Tamil, Telugu, Kannada & More | Bhasini",
                "Convert text between Indian scripts online: Devanagari to Tamil, Kannada to Telugu, Bengali to Gujarati and more. Also turns romanised text into any Indian script."));
            return pages;
        }

        public static SitePage? Find(string? slug) =>
            string.IsNullOrEmpty(slug) ? null : All.FirstOrDefault(p => string.Equals(p.Slug, slug.Trim('/'), StringComparison.OrdinalIgnoreCase));
    }
}
