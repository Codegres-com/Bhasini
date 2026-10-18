using System.Text.RegularExpressions;

namespace Bhasini.Core.Scripts
{
    public static class ScriptMappers
    {
        public static readonly OffsetScriptMapper Devanagari = new(Script.Devanagari, 0x0900);

        public static readonly OffsetScriptMapper Bengali = new(
            Script.Bengali, 0x0980,
            reverseExtras: BengaliReverse(),
            phoneticPost: BengaliYaShruti);

        // Assamese uses the Bengali block with its own ra (ৰ) and wa (ৱ).
        public static readonly OffsetScriptMapper Assamese = new(
            Script.Bengali, 0x0980,
            overrides: new() { ['र'] = "ৰ", ['व'] = "ৱ" },
            reverseExtras: BengaliReverse(),
            phoneticPost: BengaliYaShruti);

        public static readonly OffsetScriptMapper Gurmukhi = new(
            Script.Gurmukhi, 0x0A00,
            reverseExtras: new() { ['ੰ'] = "ं", ['ੱ'] = "" },
            phoneticPost: GurmukhiSpelling);

        public static readonly OffsetScriptMapper Gujarati = new(Script.Gujarati, 0x0A80);

        public static readonly OffsetScriptMapper Odia = new(
            Script.Odia, 0x0B00,
            overrides: new() { ['य'] = "ୟ", ['व'] = "ୱ" },
            reverseExtras: new() { ['ୟ'] = "य", ['ୱ'] = "व" });

        public static readonly OffsetScriptMapper Tamil = new(
            Script.Tamil, 0x0B80,
            overrides: new() { ['ं'] = "ம்" },
            prePass: s => s.Replace("फ़", "ःप"));

        public static readonly OffsetScriptMapper Telugu = new(
            Script.Telugu, 0x0C00,
            unsupported: new[] { 0x0C3C });

        public static readonly OffsetScriptMapper Kannada = new(
            Script.Kannada, 0x0C80,
            overrides: new() { ['ऴ'] = "ೞ" },
            reverseExtras: new() { ['ೞ'] = "ऴ" });

        public static readonly OffsetScriptMapper Malayalam = new(
            Script.Malayalam, 0x0D00,
            unsupported: new[] { 0x0D3C },
            reverseExtras: new()
            {
                ['ൺ'] = "ण्", ['ൻ'] = "न्", ['ർ'] = "र्", ['ൽ'] = "ल्", ['ൾ'] = "ळ्", ['ൿ'] = "क्",
            },
            phoneticPost: MalayalamSpelling);

        public static readonly MeeteiMayekMapper MeeteiMayek = new();

        // Mappers that text can be converted from (one per Unicode block).
        public static IReadOnlyList<IScriptMapper> Sources { get; } = new IScriptMapper[]
        {
            Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, MeeteiMayek,
        };

        private static Dictionary<char, string> BengaliReverse() => new()
        {
            ['ৰ'] = "र", ['ৱ'] = "व", ['ৎ'] = "त्",
        };

        // য after a vowel is pronounced and written য় (antahstha ya).
        private static readonly Regex BengaliYa = new("(?<=[অ-ঔা-ৌ])য(?!়)", RegexOptions.Compiled);

        private static string BengaliYaShruti(string s) => BengaliYa.Replace(s, "য়");

        private static readonly Regex GurmukhiAddak = new("([ਕ-ਹ])੍\\1", RegexOptions.Compiled);
        private static readonly Regex GurmukhiNasal = new(
            "[ਙਞਣਨਮ]੍(?=[ਕ-ਘਚ-ਝਟ-ਢਤ-ਧਪ-ਭਸ਼ਸ])",
            RegexOptions.Compiled);
        private static readonly Regex GurmukhiTippi = new("(?<=[ਅਇਉਕ-ਹ਼ਿੁੂ])ਂ", RegexOptions.Compiled);

        // Doubled consonants take addak, a nasal before a stop becomes bindi, and bindi becomes
        // tippi after the inherent vowel and the short vowels.
        private static string GurmukhiSpelling(string s)
        {
            s = GurmukhiAddak.Replace(s, "ੱ$1");
            s = GurmukhiNasal.Replace(s, "ਂ");
            return GurmukhiTippi.Replace(s, "ੰ");
        }

        private static readonly Regex MalayalamChillu = new("(?<!്)([ണനരലള])്(?=$|[^ഀ-ൿ])", RegexOptions.Compiled);
        private static readonly Regex MalayalamFinalM = new("(?<!്)മ്(?=$|[^ഀ-ൿ])", RegexOptions.Compiled);

        private static readonly Dictionary<char, char> Chillus = new()
        {
            ['ണ'] = 'ൺ', ['ന'] = 'ൻ', ['ര'] = 'ർ', ['ല'] = 'ൽ', ['ള'] = 'ൾ',
        };

        // Word-final n, N, r, l, L become chillus and final m becomes anusvara, as in Mozhi typing.
        private static string MalayalamSpelling(string s)
        {
            s = MalayalamChillu.Replace(s, m => Chillus[m.Groups[1].Value[0]].ToString());
            return MalayalamFinalM.Replace(s, "ം");
        }
    }
}
