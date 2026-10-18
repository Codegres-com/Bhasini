using System.Text;

namespace Bhasini.Core.Scripts
{
    // Manipuri in Meetei Mayek (U+ABC0..U+ABFF). Syllable-final consonants use the lonsum letters;
    // clusters keep the apun iyek (virama).
    public sealed class MeeteiMayekMapper : IScriptMapper
    {
        private const char ApunIyek = '꯭';

        private static readonly Dictionary<char, string> Map = new()
        {
            // consonants
            ['क'] = "ꯀ", ['ख'] = "ꯈ", ['ग'] = "ꯒ", ['घ'] = "ꯘ", ['ङ'] = "ꯉ",
            ['च'] = "ꯆ", ['छ'] = "ꯆ", ['ज'] = "ꯖ", ['झ'] = "ꯓ", ['ञ'] = "ꯅ",
            ['ट'] = "ꯇ", ['ठ'] = "ꯊ", ['ड'] = "ꯗ", ['ढ'] = "ꯙ", ['ण'] = "ꯅ",
            ['त'] = "ꯇ", ['थ'] = "ꯊ", ['द'] = "ꯗ", ['ध'] = "ꯙ", ['न'] = "ꯅ", ['ऩ'] = "ꯅ",
            ['प'] = "ꯄ", ['फ'] = "ꯐ", ['ब'] = "ꯕ", ['भ'] = "ꯚ", ['म'] = "ꯃ",
            ['य'] = "ꯌ", ['र'] = "ꯔ", ['ऱ'] = "ꯔ", ['ल'] = "ꯂ", ['ळ'] = "ꯂ", ['ऴ'] = "ꯂ", ['व'] = "ꯋ",
            ['श'] = "ꯁ", ['ष'] = "ꯁ", ['स'] = "ꯁ", ['ह'] = "ꯍ",
            // independent vowels
            ['अ'] = "ꯑ", ['आ'] = "ꯑꯥ", ['इ'] = "ꯏ", ['ई'] = "ꯏ", ['उ'] = "ꯎ", ['ऊ'] = "ꯎ",
            ['ऋ'] = "ꯔꯤ", ['ए'] = "ꯑꯦ", ['ऐ'] = "ꯑꯩ", ['ओ'] = "ꯑꯣ", ['औ'] = "ꯑꯧ",
            ['ऎ'] = "ꯑꯦ", ['ऒ'] = "ꯑꯣ", ['ऍ'] = "ꯑꯦ", ['ऑ'] = "ꯑꯣ",
            // vowel signs and marks
            ['ा'] = "ꯥ", ['ि'] = "ꯤ", ['ी'] = "ꯤ", ['ु'] = "ꯨ", ['ू'] = "ꯨ", ['ृ'] = "꯭ꯔꯤ",
            ['े'] = "ꯦ", ['ै'] = "ꯩ", ['ो'] = "ꯣ", ['ौ'] = "ꯧ",
            ['ॆ'] = "ꯦ", ['ॊ'] = "ꯣ", ['ॅ'] = "ꯦ", ['ॉ'] = "ꯣ",
            ['ं'] = "ꯪ", ['ँ'] = "ꯪ", ['ः'] = "", ['़'] = "", ['ऽ'] = "", ['्'] = "꯭",
            ['।'] = "꯫", ['॥'] = "꯫꯫",
        };

        private static readonly Dictionary<char, char> Lonsum = new()
        {
            ['ꯀ'] = 'ꯛ', ['ꯂ'] = 'ꯜ', ['ꯃ'] = 'ꯝ', ['ꯄ'] = 'ꯞ', ['ꯅ'] = 'ꯟ', ['ꯇ'] = 'ꯠ', ['ꯉ'] = 'ꯡ',
        };

        private static readonly Dictionary<char, string> Reverse = new()
        {
            ['ꯀ'] = "क", ['ꯈ'] = "ख", ['ꯒ'] = "ग", ['ꯘ'] = "घ", ['ꯉ'] = "ङ", ['ꯆ'] = "च", ['ꯖ'] = "ज",
            ['ꯓ'] = "झ", ['ꯇ'] = "त", ['ꯊ'] = "थ", ['ꯗ'] = "द", ['ꯙ'] = "ध", ['ꯅ'] = "न", ['ꯄ'] = "प",
            ['ꯐ'] = "फ", ['ꯕ'] = "ब", ['ꯚ'] = "भ", ['ꯃ'] = "म", ['ꯌ'] = "य", ['ꯔ'] = "र", ['ꯂ'] = "ल",
            ['ꯋ'] = "व", ['ꯁ'] = "स", ['ꯍ'] = "ह",
            ['ꯛ'] = "क्", ['ꯜ'] = "ल्", ['ꯝ'] = "म्", ['ꯞ'] = "प्", ['ꯟ'] = "न्", ['ꯠ'] = "त्", ['ꯡ'] = "ङ्", ['ꯢ'] = "ई",
            ['ꯑ'] = "अ", ['ꯏ'] = "इ", ['ꯎ'] = "उ",
            ['ꯥ'] = "ा", ['ꯤ'] = "ि", ['ꯨ'] = "ु", ['ꯦ'] = "े", ['ꯩ'] = "ै", ['ꯣ'] = "ो", ['ꯧ'] = "ौ",
            ['ꯪ'] = "ं", ['꯭'] = "्", ['꯫'] = "।", ['꯬'] = "",
        };

        private static readonly Dictionary<char, string> AtiyaWithSign = new()
        {
            ['ꯥ'] = "आ", ['ꯦ'] = "ए", ['ꯩ'] = "ऐ", ['ꯣ'] = "ओ", ['ꯧ'] = "औ", ['ꯤ'] = "इ", ['ꯨ'] = "उ",
        };

        public Script Script => Script.MeeteiMayek;

        public bool Owns(char c) => c >= 'ꯀ' && c <= '꯿';

        public char NativeDigit(int digit) => (char)(0xABF0 + digit);

        private static bool IsConsonant(char c) => (c >= 'ꯀ' && c <= 'ꯍ') || (c >= 'ꯐ' && c <= 'ꯚ' && c != 'ꯑ');

        public string FromDevanagari(string deva, bool phonetic)
        {
            if (string.IsNullOrEmpty(deva)) return string.Empty;

            var mapped = new StringBuilder(deva.Length);
            foreach (var c in deva)
            {
                if (Map.TryGetValue(c, out var m)) mapped.Append(m);
                else if (c >= '०' && c <= '९') mapped.Append(NativeDigit(c - '०'));
                else mapped.Append(c);
            }

            // Consonant + apun iyek: lonsum at a syllable end, apun kept for r/y/w clusters,
            // dropped at a word end when the consonant has no lonsum form.
            var s = mapped.ToString();
            var sb = new StringBuilder(s.Length);
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (IsConsonant(c) && i + 1 < s.Length && s[i + 1] == ApunIyek)
                {
                    char next = i + 2 < s.Length ? s[i + 2] : '\0';
                    bool cluster = IsConsonant(next) && (next == 'ꯔ' || next == 'ꯌ' || next == 'ꯋ');
                    if (!cluster && Lonsum.TryGetValue(c, out var lonsum))
                    {
                        sb.Append(lonsum);
                        i++;
                        continue;
                    }
                    if (!IsConsonant(next))
                    {
                        sb.Append(c);
                        i++;
                        continue;
                    }
                }
                sb.Append(c);
            }
            return sb.ToString();
        }

        public string ToDevanagari(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;

            var sb = new StringBuilder(text.Length);
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                if (c == 'ꯑ' && i + 1 < text.Length && AtiyaWithSign.TryGetValue(text[i + 1], out var vowel))
                {
                    sb.Append(vowel);
                    i++;
                }
                else if (Reverse.TryGetValue(c, out var r)) sb.Append(r);
                else if (c >= '꯰' && c <= '꯹') sb.Append((char)('०' + (c - '꯰')));
                else sb.Append(c);
            }
            return sb.ToString();
        }
    }
}
