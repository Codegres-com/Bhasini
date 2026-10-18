namespace Bhasini.Core.Input
{
    // The government-standard InScript layout. Keys sit on the same letters in every Brahmic
    // script, so one Devanagari table serves all of them through the script mapper.
    public static class InscriptLayout
    {
        private static readonly Dictionary<char, string> Keys = new()
        {
            ['`'] = "ॊ", ['~'] = "ऒ",
            ['!'] = "ऍ", ['@'] = "ॅ", ['#'] = "्र", ['$'] = "र्", ['%'] = "ज्ञ", ['^'] = "त्र", ['&'] = "क्ष", ['*'] = "श्र",
            ['_'] = "ः", ['='] = "ृ", ['+'] = "ऋ",
            ['q'] = "ौ", ['Q'] = "औ", ['w'] = "ै", ['W'] = "ऐ", ['e'] = "ा", ['E'] = "आ", ['r'] = "ी", ['R'] = "ई",
            ['t'] = "ू", ['T'] = "ऊ", ['y'] = "ब", ['Y'] = "भ", ['u'] = "ह", ['U'] = "ङ", ['i'] = "ग", ['I'] = "घ",
            ['o'] = "द", ['O'] = "ध", ['p'] = "ज", ['P'] = "झ", ['['] = "ड", ['{'] = "ढ", [']'] = "़", ['}'] = "ञ",
            ['\\'] = "ॉ", ['|'] = "ऑ",
            ['a'] = "ो", ['A'] = "ओ", ['s'] = "े", ['S'] = "ए", ['d'] = "्", ['D'] = "अ", ['f'] = "ि", ['F'] = "इ",
            ['g'] = "ु", ['G'] = "उ", ['h'] = "प", ['H'] = "फ", ['j'] = "र", ['J'] = "ऱ", ['k'] = "क", ['K'] = "ख",
            ['l'] = "त", ['L'] = "थ", [';'] = "च", [':'] = "छ", ['\''] = "ट", ['"'] = "ठ",
            ['z'] = "ॆ", ['Z'] = "ऎ", ['x'] = "ं", ['X'] = "ँ", ['c'] = "म", ['C'] = "ण", ['v'] = "न", ['V'] = "ऩ",
            ['b'] = "व", ['B'] = "ऴ", ['n'] = "ल", ['N'] = "ळ", ['m'] = "स", ['M'] = "श", ['<'] = "ष",
            ['>'] = "।", ['/'] = "य", ['?'] = "य़",
        };

        public static string? Map(char key) => Keys.TryGetValue(key, out var deva) ? deva : null;

        public static IEnumerable<(char Key, string Deva)> All => Keys.Select(kv => (kv.Key, kv.Value));

        // Rows of the physical keyboard, for the on-screen layout view.
        public static readonly string[] Rows =
        {
            "`1234567890-=",
            "qwertyuiop[]\\",
            "asdfghjkl;'",
            "zxcvbnm,./",
        };

        public static readonly string[] ShiftRows =
        {
            "~!@#$%^&*()_+",
            "QWERTYUIOP{}|",
            "ASDFGHJKL:\"",
            "ZXCVBNM<>?",
        };
    }
}
