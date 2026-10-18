using Bhasini.Core.Input;
using Bhasini.Core.Scripts;

namespace Bhasini.Core.Languages
{
    // English plus the 22 languages of the Eighth Schedule, with the extra official scripts for
    // Kashmiri, Manipuri and Sindhi.
    public static class LanguageCatalog
    {
        private static PhoneticToken C(string deva) => new(TokenKind.Consonant, deva);
        private static PhoneticToken V(string letter, string sign) => new(TokenKind.Vowel, letter, sign);

        private static readonly PhoneticProfile North = new()
        {
            Overrides = new Dictionary<string, PhoneticToken> { ["R"] = C("ड़"), ["Rh"] = C("ढ़"), ["Ri"] = V("ऋ", "ृ") },
        };

        private static readonly PhoneticProfile Sanskrit = new()
        {
            FinalVirama = true,
            Overrides = new Dictionary<string, PhoneticToken> { ["R"] = V("ऋ", "ृ"), ["Ri"] = V("ऋ", "ृ"), ["RR"] = V("ॠ", "ॄ") },
        };

        private static readonly PhoneticProfile KannadaTelugu = new()
        {
            DravidianVowels = true,
            FinalVirama = true,
            Overrides = new Dictionary<string, PhoneticToken>
            {
                ["R"] = V("ऋ", "ृ"), ["Ru"] = V("ऋ", "ृ"), ["RU"] = V("ॠ", "ॄ"),
                ["nj"] = C("ञ"), ["zh"] = C("ऴ"),
            },
        };

        private static readonly PhoneticProfile Tamil = new()
        {
            DravidianVowels = true,
            FinalVirama = true,
            TamilNasal = true,
            Overrides = new Dictionary<string, PhoneticToken>
            {
                ["R"] = C("ऱ"), ["zh"] = C("ऴ"), ["nj"] = C("ञ"), ["sh"] = C("ष"),
                // Tamil typists write ச as "s"; ஸ stays on "S".
                ["s"] = C("च"), ["S"] = C("स"),
            },
        };

        private static readonly PhoneticProfile Malayalam = new()
        {
            DravidianVowels = true,
            FinalVirama = true,
            Overrides = new Dictionary<string, PhoneticToken>
            {
                ["R"] = C("ऱ"), ["zh"] = C("ऴ"), ["nj"] = C("ञ"),
                // Mozhi conventions: "nt" is ന്റ (ente -> എന്റെ), "th"/"nth" are ത/ന്ത (thh for ഥ), "sh" is ഷ.
                ["nt"] = C("न्ऱ"), ["nth"] = C("न्त"), ["sh"] = C("ष"),
                ["th"] = C("त"), ["thh"] = C("थ"),
            },
        };

        private static readonly PhoneticProfile Meetei = new()
        {
            FinalVirama = true,
            Overrides = new Dictionary<string, PhoneticToken> { ["ng"] = C("ङ"), ["ei"] = V("ऐ", "ै") },
        };

        private static readonly Dictionary<char, string> ArabicPunctuation = new()
        {
            ['?'] = "؟", [','] = "،", [';'] = "؛", ['.'] = "۔", ['%'] = "٪",
        };

        private static readonly Func<int, char> ArabicDigits = d => (char)(0x06F0 + d);

        private static IndicLanguage Brahmic(
            string code, string name, string native, int since, OffsetScriptMapper mapper, string scriptName,
            PhoneticProfile profile, string fontClass, string sample, string? speech) => new()
        {
            Code = code,
            Name = name,
            NativeName = native,
            ScheduledSince = since,
            Script = mapper.Script,
            ScriptName = scriptName,
            Mapper = mapper,
            Phonetic = new BrahmicPhoneticEngine(profile, mapper),
            FontClass = fontClass,
            SampleInput = sample,
            SpeechLocale = speech,
            DigitMapper = mapper.NativeDigit,
        };

        private static IndicLanguage Arabic(
            string code, string name, string native, int since, Dictionary<string, SequenceEntry> map,
            (string, string[])[] groups, string fontClass, string sample, string? speech) => new()
        {
            Code = code,
            Name = name,
            NativeName = native,
            ScheduledSince = since,
            Script = Script.PersoArabic,
            ScriptName = "Perso-Arabic",
            Phonetic = new SequenceEngine(map, groups),
            RightToLeft = true,
            FontClass = fontClass,
            SampleInput = sample,
            SpeechLocale = speech,
            Punctuation = ArabicPunctuation,
            DigitMapper = ArabicDigits,
        };

        public static readonly IndicLanguage English = new()
        {
            Code = "en",
            Name = "English",
            NativeName = "English",
            Script = Script.Latin,
            ScriptName = "Latin",
            FontClass = "script-latn",
            SampleInput = "Hello",
            SpeechLocale = "en-IN",
        };

        public static IReadOnlyList<IndicLanguage> All { get; } = new List<IndicLanguage>
        {
            Brahmic("as", "Assamese", "অসমীয়া", 1950, ScriptMappers.Assamese, "Bengali-Assamese", North, "script-beng", "namaskAr", "as-IN"),
            Brahmic("bn", "Bengali", "বাংলা", 1950, ScriptMappers.Bengali, "Bengali", North, "script-beng", "namaskAr bAMlA", "bn-IN"),
            Brahmic("brx", "Bodo", "बड़ो", 2003, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "baRo", null),
            Brahmic("doi", "Dogri", "डोगरी", 2003, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "DogarI", null),
            Brahmic("gu", "Gujarati", "ગુજરાતી", 1950, ScriptMappers.Gujarati, "Gujarati", North, "script-gujr", "namaste gujarAtI", "gu-IN"),
            Brahmic("hi", "Hindi", "हिन्दी", 1950, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "namaste hindI", "hi-IN"),
            Brahmic("kn", "Kannada", "ಕನ್ನಡ", 1950, ScriptMappers.Kannada, "Kannada", KannadaTelugu, "script-knda", "namaskAra kannaDa", "kn-IN"),
            Arabic("ks", "Kashmiri", "کٲشُر", 1950, SequenceMaps.Kashmiri(), SequenceMaps.KashmiriGroups, "script-arab-nastaliq", "kashur", null),
            Brahmic("ks-Deva", "Kashmiri (Devanagari)", "कॉशुर", 1950, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "k^oshur", null),
            Brahmic("kok", "Konkani", "कोंकणी", 1992, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "koMkaNI", null),
            Brahmic("mai", "Maithili", "मैथिली", 2003, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "maithilI", null),
            Brahmic("ml", "Malayalam", "മലയാളം", 1950, ScriptMappers.Malayalam, "Malayalam", Malayalam, "script-mlym", "namaskaaram malayaaLam", "ml-IN"),
            new IndicLanguage
            {
                Code = "mni",
                Name = "Manipuri",
                NativeName = "ꯃꯤꯇꯩꯂꯣꯟ",
                ScheduledSince = 1992,
                Script = Script.MeeteiMayek,
                ScriptName = "Meetei Mayek",
                Mapper = ScriptMappers.MeeteiMayek,
                Phonetic = new BrahmicPhoneticEngine(Meetei, ScriptMappers.MeeteiMayek),
                FontClass = "script-mtei",
                SampleInput = "meeteilon",
                DigitMapper = ScriptMappers.MeeteiMayek.NativeDigit,
            },
            Brahmic("mni-Beng", "Manipuri (Bengali)", "মৈতৈলোন্", 1992, ScriptMappers.Bengali, "Bengali", North, "script-beng", "maitailon", null),
            Brahmic("mr", "Marathi", "मराठी", 1950, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "namaskAr marAThI", "mr-IN"),
            Brahmic("ne", "Nepali", "नेपाली", 1992, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "namaste nepAlI", "ne-NP"),
            Brahmic("or", "Odia", "ଓଡ଼ିଆ", 1950, ScriptMappers.Odia, "Odia", North, "script-orya", "namaskAra o.DiA", "or-IN"),
            Brahmic("pa", "Punjabi", "ਪੰਜਾਬੀ", 1950, ScriptMappers.Gurmukhi, "Gurmukhi", North, "script-guru", "sat srI akAl panjAbI", "pa-Guru-IN"),
            Brahmic("sa", "Sanskrit", "संस्कृतम्", 1950, ScriptMappers.Devanagari, "Devanagari", Sanskrit, "script-deva", "saMskRtam", "sa-IN"),
            new IndicLanguage
            {
                Code = "sat",
                Name = "Santali",
                NativeName = "ᱥᱟᱱᱛᱟᱲᱤ",
                ScheduledSince = 2003,
                Script = Script.OlChiki,
                ScriptName = "Ol Chiki",
                Phonetic = new SequenceEngine(SequenceMaps.OlChiki(), SequenceMaps.OlChikiGroups),
                FontClass = "script-olck",
                SampleInput = "santaRi",
                Punctuation = new Dictionary<char, string> { ['.'] = "᱾", ['|'] = "᱾" },
                DigitMapper = d => (char)(0x1C50 + d),
            },
            Arabic("sd", "Sindhi", "سنڌي", 1967, SequenceMaps.Sindhi(), SequenceMaps.SindhiGroups, "script-arab-naskh", "sindhii", "sd-IN"),
            Brahmic("sd-Deva", "Sindhi (Devanagari)", "सिन्धी", 1967, ScriptMappers.Devanagari, "Devanagari", North, "script-deva", "sindhI", null),
            Brahmic("ta", "Tamil", "தமிழ்", 1950, ScriptMappers.Tamil, "Tamil", Tamil, "script-taml", "vaNakkam thamizh", "ta-IN"),
            Brahmic("te", "Telugu", "తెలుగు", 1950, ScriptMappers.Telugu, "Telugu", KannadaTelugu, "script-telu", "namaskAraM telugu", "te-IN"),
            Arabic("ur", "Urdu", "اردو", 1950, SequenceMaps.Urdu(), SequenceMaps.UrduGroups, "script-arab-nastaliq", "aadaab urdu", "ur-IN"),
            English,
        };

        public static IndicLanguage Default => Get("hi");

        public static IndicLanguage Get(string? code) =>
            All.FirstOrDefault(l => string.Equals(l.Code, code, StringComparison.OrdinalIgnoreCase)) ?? All.First(l => l.Code == "hi");

        // The 22 scheduled languages, counting a language once even when it has several scripts.
        public static int ScheduledLanguageCount => All.Where(l => l.ScheduledSince != null).Select(l => l.Code.Split('-')[0]).Distinct().Count();
    }
}
