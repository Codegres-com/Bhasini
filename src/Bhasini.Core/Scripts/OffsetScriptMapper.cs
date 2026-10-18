using System.Globalization;
using System.Text;

namespace Bhasini.Core.Scripts
{
    // Mapper for the nine ISCII-derived Unicode blocks (Devanagari, Bengali, Gurmukhi, Gujarati,
    // Odia, Tamil, Telugu, Kannada, Malayalam). They share one layout, so a letter's offset from the
    // block start is the same in every script; letters a script lacks fall back to the nearest one.
    public class OffsetScriptMapper : IScriptMapper
    {
        public const int DevanagariBase = 0x0900;
        private const char Virama = '्';
        private const char Nukta = '़';

        private readonly int _base;
        private readonly Dictionary<char, string> _overrides;
        private readonly HashSet<int> _unsupported;
        private readonly Dictionary<char, string> _reverseExtras;
        private readonly Func<string, string>? _prePass;
        private readonly Func<string, string>? _phoneticPost;

        // Replacement (in Devanagari space) for a letter that the target script does not have.
        private static readonly Dictionary<char, string> Fallback = new()
        {
            ['ँ'] = "ं",                // candrabindu -> anusvara
            ['ऍ'] = "ए", ['ॅ'] = "े", // candra e -> e
            ['ऑ'] = "ओ", ['ॉ'] = "ो", // candra o -> o
            ['ऎ'] = "ए", ['ॆ'] = "े", // short e -> e
            ['ऒ'] = "ओ", ['ॊ'] = "ो", // short o -> o
            ['ऋ'] = "रि", ['ृ'] = "्रि", // vocalic r -> ri
            ['ॠ'] = "री", ['ॄ'] = "्री",
            ['ऌ'] = "लि", ['ॢ'] = "्लि",
            ['ॡ'] = "ली", ['ॣ'] = "्ली",
            ['ख'] = "क", ['ग'] = "क", ['घ'] = "ग", ['ङ'] = "न",
            ['छ'] = "च", ['झ'] = "ज", ['ञ'] = "न",
            ['ठ'] = "ट", ['ड'] = "ट", ['ढ'] = "ड",
            ['थ'] = "त", ['द'] = "त", ['ध'] = "द",
            ['फ'] = "प", ['ब'] = "प", ['भ'] = "ब",
            ['ऩ'] = "न", ['ऱ'] = "र", ['ऴ'] = "ळ", ['ळ'] = "ल",
            ['व'] = "ब", ['ष'] = "श", ['श'] = "स",
            ['़'] = "", ['ऽ'] = "", ['ः'] = "",
            ['ॐ'] = "ओम्",
        };

        public OffsetScriptMapper(
            Script script,
            int blockBase,
            Dictionary<char, string>? overrides = null,
            IEnumerable<int>? unsupported = null,
            Dictionary<char, string>? reverseExtras = null,
            Func<string, string>? prePass = null,
            Func<string, string>? phoneticPost = null)
        {
            Script = script;
            _base = blockBase;
            _overrides = overrides ?? new();
            _unsupported = new HashSet<int>(unsupported ?? Array.Empty<int>());
            _reverseExtras = reverseExtras ?? new();
            _prePass = prePass;
            _phoneticPost = phoneticPost;
        }

        public Script Script { get; }

        public int BlockBase => _base;

        public bool Owns(char c) => c >= _base && c < _base + 0x80;

        public char NativeDigit(int digit) => (char)(_base + 0x66 + digit);

        // Code points whose meaning is shared across the nine blocks.
        private static bool IsMappable(int c) =>
            (c >= 0x0901 && c <= 0x0903) ||
            (c >= 0x0905 && c <= 0x0939) ||
            (c >= 0x093C && c <= 0x094D) ||
            c == 0x0950 ||
            (c >= 0x0960 && c <= 0x0963) ||
            (c >= 0x0966 && c <= 0x096F);

        private bool IsAvailable(int target) =>
            !_unsupported.Contains(target) &&
            CharUnicodeInfo.GetUnicodeCategory(target) != UnicodeCategory.OtherNotAssigned;

        public string FromDevanagari(string deva, bool phonetic)
        {
            if (string.IsNullOrEmpty(deva)) return string.Empty;

            var input = Decompose(deva);
            if (_prePass != null) input = _prePass(input);

            var sb = new StringBuilder(input.Length);
            foreach (var c in input)
            {
                AppendChar(sb, c, 0);
            }

            var result = sb.ToString();
            return phonetic && _phoneticPost != null ? _phoneticPost(result) : result;
        }

        private void AppendChar(StringBuilder sb, char c, int depth)
        {
            if (_overrides.TryGetValue(c, out var replaced))
            {
                sb.Append(replaced);
                return;
            }

            if (!IsMappable(c))
            {
                sb.Append(c);
                return;
            }

            if (_base == DevanagariBase)
            {
                sb.Append(c);
                return;
            }

            int target = _base + (c - DevanagariBase);
            if (IsAvailable(target))
            {
                sb.Append((char)target);
                return;
            }

            if (depth < 4 && Fallback.TryGetValue(c, out var fb))
            {
                foreach (var f in fb) AppendChar(sb, f, depth + 1);
            }
        }

        // Precomposed nukta letters (U+0958..U+095F) to base + nukta, so each script can decide
        // whether it has a nukta at all.
        private static string Decompose(string s)
        {
            bool needs = false;
            foreach (var c in s)
            {
                if (c >= 'क़' && c <= 'य़') { needs = true; break; }
            }
            if (!needs) return s;

            var sb = new StringBuilder(s.Length + 4);
            foreach (var c in s)
            {
                switch (c)
                {
                    case 'क़': sb.Append('क').Append(Nukta); break;
                    case 'ख़': sb.Append('ख').Append(Nukta); break;
                    case 'ग़': sb.Append('ग').Append(Nukta); break;
                    case 'ज़': sb.Append('ज').Append(Nukta); break;
                    case 'ड़': sb.Append('ड').Append(Nukta); break;
                    case 'ढ़': sb.Append('ढ').Append(Nukta); break;
                    case 'फ़': sb.Append('फ').Append(Nukta); break;
                    case 'य़': sb.Append('य').Append(Nukta); break;
                    default: sb.Append(c); break;
                }
            }
            return sb.ToString();
        }

        public string ToDevanagari(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;

            var sb = new StringBuilder(text.Length);
            foreach (var c in text)
            {
                if (_reverseExtras.TryGetValue(c, out var extra))
                {
                    sb.Append(extra);
                    continue;
                }

                if (Owns(c))
                {
                    int deva = DevanagariBase + (c - _base);
                    if (IsMappable(deva) || (deva >= 0x0958 && deva <= 0x095F))
                    {
                        sb.Append((char)deva);
                        continue;
                    }
                }
                sb.Append(c);
            }
            return sb.ToString();
        }
    }
}
