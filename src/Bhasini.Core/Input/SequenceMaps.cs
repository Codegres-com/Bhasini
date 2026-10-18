namespace Bhasini.Core.Input
{
    public static class SequenceMaps
    {
        private static SequenceEntry E(string medial, string? initial = null, string? final = null) => new(medial, initial, final);

        private static readonly string[] ArabicVowelKeys = { "a", "aa", "A", "i", "ii", "ee", "I", "u", "uu", "oo", "U", "e", "E", "ai", "o", "O", "au", "ou" };

        // Urdu phonetic: short vowels are unwritten inside a word, aspirates take do-chashmi he (ھ).
        public static Dictionary<string, SequenceEntry> Urdu() => new()
        {
            ["a"] = E("", "ا", "ا"), ["aa"] = E("ا", "آ"), ["A"] = E("ا", "آ"),
            ["i"] = E("", "ا", "ی"), ["ii"] = E("ی", "ای"), ["ee"] = E("ی", "ای"), ["I"] = E("ی", "ای"),
            ["u"] = E("", "ا", "و"), ["uu"] = E("و", "او"), ["oo"] = E("و", "او"), ["U"] = E("و", "او"),
            ["e"] = E("ی", "ای", "ے"), ["E"] = E("ی", "ای", "ے"), ["ai"] = E("ی", "اے", "ے"),
            ["o"] = E("و", "او"), ["O"] = E("و", "او"), ["au"] = E("و", "او"), ["ou"] = E("و", "او"),

            ["b"] = E("ب"), ["bh"] = E("بھ"), ["p"] = E("پ"), ["ph"] = E("پھ"), ["f"] = E("ف"),
            ["t"] = E("ت"), ["th"] = E("تھ"), ["T"] = E("ٹ"), ["Th"] = E("ٹھ"), ["t'"] = E("ط"),
            ["s"] = E("س"), ["S"] = E("ص"), ["sh"] = E("ش"), ["s'"] = E("ث"),
            ["j"] = E("ج"), ["jh"] = E("جھ"), ["c"] = E("چ"), ["ch"] = E("چ"), ["chh"] = E("چھ"),
            ["h"] = E("ہ"), ["H"] = E("ح"), ["x"] = E("خ"), ["kh"] = E("کھ"), ["KH"] = E("خ"),
            ["d"] = E("د"), ["dh"] = E("دھ"), ["D"] = E("ڈ"), ["Dh"] = E("ڈھ"),
            ["z"] = E("ز"), ["Z"] = E("ض"), ["zz"] = E("ذ"), ["z'"] = E("ظ"), ["zh"] = E("ژ"),
            ["r"] = E("ر"), ["R"] = E("ڑ"), ["Rh"] = E("ڑھ"),
            ["k"] = E("ک"), ["q"] = E("ق"), ["g"] = E("گ"), ["gh"] = E("گھ"), ["G"] = E("غ"),
            ["l"] = E("ل"), ["m"] = E("م"), ["n"] = E("ن"), ["N"] = E("ن", null, "ں"),
            ["v"] = E("و"), ["w"] = E("و"), ["y"] = E("ی"), ["Y"] = E("ے"),
            ["'"] = E("ع"), ["''"] = E("ء"),
        };

        public static readonly (string Title, string[] Keys)[] UrduGroups =
        {
            ("Vowels", ArabicVowelKeys),
            ("Consonants", new[] { "b", "bh", "p", "ph", "t", "th", "T", "Th", "t'", "s'", "j", "jh", "ch", "chh", "H", "x", "KH", "kh",
                "d", "dh", "D", "Dh", "zz", "r", "R", "Rh", "z", "zh", "s", "sh", "S", "Z", "z'", "'", "G", "f", "q", "k", "g", "gh",
                "l", "m", "n", "N", "v", "w", "h", "y", "Y", "''" }),
        };

        // Kashmiri (Perso-Arabic): Urdu letters plus ts/tsh and the Kashmiri vowel signs.
        public static Dictionary<string, SequenceEntry> Kashmiri()
        {
            var map = Urdu();
            map["ts"] = E("ژ");
            map["tsh"] = E("ژھ");
            map["aa'"] = E("ٲ", "ٲ");
            map["o'"] = E("ۄ", "اۄ");
            map["u'"] = E("ٕ");
            return map;
        }

        public static readonly (string Title, string[] Keys)[] KashmiriGroups =
        {
            ("Vowels", ArabicVowelKeys.Concat(new[] { "aa'", "o'", "u'" }).ToArray()),
            ("Consonants", UrduGroups[1].Keys.Concat(new[] { "ts", "tsh" }).ToArray()),
        };

        // Sindhi (Perso-Arabic): its own implosives and retroflexes, Arabic yeh (ي) and heh (ه).
        public static Dictionary<string, SequenceEntry> Sindhi()
        {
            static string Sindhify(string s) => s.Replace('ی', 'ي').Replace('ے', 'ي').Replace('ہ', 'ه');

            var map = Urdu().ToDictionary(
                kv => kv.Key,
                kv => new SequenceEntry(Sindhify(kv.Value.Medial),
                    kv.Value.Initial == null ? null : Sindhify(kv.Value.Initial),
                    kv.Value.Final == null ? null : Sindhify(kv.Value.Final)));

            map["k"] = E("ڪ"); map["kh"] = E("ک"); map["gg"] = E("ڳ"); map["ng"] = E("ڱ");
            map["jj"] = E("ڄ"); map["ny"] = E("ڃ"); map["chh"] = E("ڇ");
            map["T"] = E("ٽ"); map["Th"] = E("ٺ"); map["th"] = E("ٿ");
            map["D"] = E("ڊ"); map["Dh"] = E("ڍ"); map["dd"] = E("ڏ"); map["dh"] = E("ڌ");
            map["R"] = E("ڙ"); map["N"] = E("ڻ"); map["ph"] = E("ڦ");
            map["bb"] = E("ٻ"); map["bh"] = E("ڀ");
            return map;
        }

        public static readonly (string Title, string[] Keys)[] SindhiGroups =
        {
            ("Vowels", ArabicVowelKeys),
            ("Consonants", UrduGroups[1].Keys.Concat(new[] { "gg", "ng", "jj", "ny", "dd", "bb" }).ToArray()),
        };

        // Santali in Ol Chiki (alphabetic: every vowel is a letter).
        public static Dictionary<string, SequenceEntry> OlChiki() => new()
        {
            ["a"] = E("ᱟ"), ["aa"] = E("ᱟ"), ["A"] = E("ᱟ"), ["O"] = E("ᱚ"), ["aw"] = E("ᱚ"),
            ["i"] = E("ᱤ"), ["ii"] = E("ᱤ"), ["u"] = E("ᱩ"), ["uu"] = E("ᱩ"), ["e"] = E("ᱮ"), ["o"] = E("ᱳ"),
            ["k"] = E("ᱠ"), ["kh"] = E("ᱠᱷ"), ["g"] = E("ᱜ"), ["gh"] = E("ᱜᱷ"), ["ng"] = E("ᱝ"),
            ["c"] = E("ᱪ"), ["ch"] = E("ᱪ"), ["chh"] = E("ᱪᱷ"), ["j"] = E("ᱡ"), ["jh"] = E("ᱡᱷ"), ["ny"] = E("ᱧ"),
            ["T"] = E("ᱴ"), ["Th"] = E("ᱴᱷ"), ["D"] = E("ᱰ"), ["Dh"] = E("ᱰᱷ"), ["N"] = E("ᱬ"),
            ["t"] = E("ᱛ"), ["th"] = E("ᱛᱷ"), ["d"] = E("ᱫ"), ["dh"] = E("ᱫᱷ"), ["n"] = E("ᱱ"),
            ["p"] = E("ᱯ"), ["ph"] = E("ᱯᱷ"), ["b"] = E("ᱵ"), ["bh"] = E("ᱵᱷ"), ["m"] = E("ᱢ"),
            ["y"] = E("ᱭ"), ["r"] = E("ᱨ"), ["R"] = E("ᱲ"), ["Rh"] = E("ᱲᱷ"), ["l"] = E("ᱞ"),
            ["w"] = E("ᱣ"), ["v"] = E("ᱶ"), ["s"] = E("ᱥ"), ["h"] = E("ᱦ"),
            ["~"] = E("ᱸ"), ["'"] = E("ᱹ"), [":"] = E("ᱻ"), ["''"] = E("ᱽ"),
        };

        public static readonly (string Title, string[] Keys)[] OlChikiGroups =
        {
            ("Vowels", new[] { "a", "O", "i", "u", "e", "o" }),
            ("Consonants", new[] { "k", "kh", "g", "gh", "ng", "c", "chh", "j", "jh", "ny", "T", "Th", "D", "Dh", "N",
                "t", "th", "d", "dh", "n", "p", "ph", "b", "bh", "m", "y", "r", "R", "Rh", "l", "w", "v", "s", "h" }),
            ("Signs", new[] { "~", "'", ":", "''" }),
        };
    }
}
