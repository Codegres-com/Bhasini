using System.Text;
using Bhasini.Core.Scripts;

namespace Bhasini.Core.Input
{
    public enum TokenKind
    {
        Consonant,
        Vowel,
        Modifier,
        Virama,
        Separator,
        Literal
    }

    // Text is in Devanagari space. For vowels, Text is the independent letter and Sign the matra.
    public sealed record PhoneticToken(TokenKind Kind, string Text, string Sign = "");

    public sealed class PhoneticProfile
    {
        // Dravidian languages distinguish short e/o (e, o) from long (E/ee, O/oo).
        public bool DravidianVowels { get; init; }

        // Word-final consonants without a vowel take a virama (Kannada, Tamil, Sanskrit…);
        // otherwise they keep the inherent vowel (Hindi "kamal" -> कमल).
        public bool FinalVirama { get; init; }

        // Tamil: "n" is ந at a word start or before a dental, ன elsewhere.
        public bool TamilNasal { get; init; }

        public IReadOnlyDictionary<string, PhoneticToken> Overrides { get; init; } = new Dictionary<string, PhoneticToken>();
    }

    // ITRANS / Baraha-style phonetic typing for every Brahmic script: Latin -> Devanagari space,
    // then the language's script mapper.
    public sealed class BrahmicPhoneticEngine : ITransliterator
    {
        private const string Virama = "्";

        private readonly PhoneticProfile _profile;
        private readonly IScriptMapper _mapper;
        private readonly Dictionary<string, PhoneticToken> _table;
        private readonly int _maxTokenLength;
        private IReadOnlyList<KeymapGroup>? _keymap;

        private static PhoneticToken C(string deva) => new(TokenKind.Consonant, deva);
        private static PhoneticToken V(string letter, string sign) => new(TokenKind.Vowel, letter, sign);

        // Keys listed together are aliases; the first is shown first in the keymap.
        private static readonly (string[] Keys, PhoneticToken Token)[] BaseVowels =
        {
            (new[] { "a" }, V("अ", "")),
            (new[] { "aa", "A" }, V("आ", "ा")),
            (new[] { "i" }, V("इ", "ि")),
            (new[] { "ii", "I" }, V("ई", "ी")),
            (new[] { "u" }, V("उ", "ु")),
            (new[] { "uu", "U" }, V("ऊ", "ू")),
            (new[] { "R^i", "RRi" }, V("ऋ", "ृ")),
            (new[] { "R^I", "RRI" }, V("ॠ", "ॄ")),
            (new[] { "E" }, V("ए", "े")),
            (new[] { "ai" }, V("ऐ", "ै")),
            (new[] { "O" }, V("ओ", "ो")),
            (new[] { "au", "ou" }, V("औ", "ौ")),
            (new[] { "^e" }, V("ऍ", "ॅ")),
            (new[] { "^o" }, V("ऑ", "ॉ")),
        };

        private static readonly (string[] Keys, PhoneticToken Token)[] NorthVowels =
        {
            (new[] { "e" }, V("ए", "े")),
            (new[] { "ee" }, V("ई", "ी")),
            (new[] { "o" }, V("ओ", "ो")),
            (new[] { "oo" }, V("ऊ", "ू")),
        };

        private static readonly (string[] Keys, PhoneticToken Token)[] DravidianVowels =
        {
            (new[] { "e" }, V("ऎ", "ॆ")),
            (new[] { "ee" }, V("ए", "े")),
            (new[] { "o" }, V("ऒ", "ॊ")),
            (new[] { "oo" }, V("ओ", "ो")),
        };

        private static readonly (string[] Keys, PhoneticToken Token)[] BaseConsonants =
        {
            (new[] { "k" }, C("क")), (new[] { "kh", "K" }, C("ख")), (new[] { "g" }, C("ग")),
            (new[] { "gh", "G" }, C("घ")), (new[] { "~N", "N^", "NG" }, C("ङ")),
            (new[] { "ch", "c" }, C("च")), (new[] { "chh", "Ch", "C" }, C("छ")), (new[] { "j" }, C("ज")),
            (new[] { "jh", "J" }, C("झ")), (new[] { "~n", "JN" }, C("ञ")),
            (new[] { "T" }, C("ट")), (new[] { "Th" }, C("ठ")), (new[] { "D" }, C("ड")),
            (new[] { "Dh" }, C("ढ")), (new[] { "N" }, C("ण")),
            (new[] { "t" }, C("त")), (new[] { "th" }, C("थ")), (new[] { "d" }, C("द")),
            (new[] { "dh" }, C("ध")), (new[] { "n" }, C("न")),
            (new[] { "p" }, C("प")), (new[] { "ph", "P" }, C("फ")), (new[] { "b" }, C("ब")),
            (new[] { "bh", "B" }, C("भ")), (new[] { "m" }, C("म")),
            (new[] { "y" }, C("य")), (new[] { "r" }, C("र")), (new[] { "l" }, C("ल")),
            (new[] { "v", "w" }, C("व")), (new[] { "sh", "S" }, C("श")), (new[] { "Sh", "shh" }, C("ष")),
            (new[] { "s" }, C("स")), (new[] { "h" }, C("ह")), (new[] { "L" }, C("ळ")),
            (new[] { "x", "ksh" }, C("क्ष")), (new[] { "GY", "jn", "dny" }, C("ज्ञ")),
            (new[] { "q" }, C("क़")), (new[] { "z" }, C("ज़")), (new[] { "f" }, C("फ़")),
            (new[] { ".D" }, C("ड़")), (new[] { ".Dh" }, C("ढ़")),
            (new[] { "rx" }, C("ऱ")), (new[] { "Lx" }, C("ऴ")), (new[] { "nx" }, C("ऩ")),
        };

        private static readonly (string[] Keys, PhoneticToken Token)[] BaseMarks =
        {
            (new[] { "M", ".n" }, new PhoneticToken(TokenKind.Modifier, "ं")),
            (new[] { "H" }, new PhoneticToken(TokenKind.Modifier, "ः")),
            (new[] { ".N", "~" }, new PhoneticToken(TokenKind.Modifier, "ँ")),
            (new[] { ".h" }, new PhoneticToken(TokenKind.Virama, Virama)),
            (new[] { "_" }, new PhoneticToken(TokenKind.Separator, "")),
            (new[] { ".a" }, new PhoneticToken(TokenKind.Literal, "ऽ")),
            (new[] { "OM" }, new PhoneticToken(TokenKind.Literal, "ॐ")),
            (new[] { "|" }, new PhoneticToken(TokenKind.Literal, "।")),
            (new[] { "||" }, new PhoneticToken(TokenKind.Literal, "॥")),
        };

        public BrahmicPhoneticEngine(PhoneticProfile profile, IScriptMapper mapper)
        {
            _profile = profile;
            _mapper = mapper;
            _table = new Dictionary<string, PhoneticToken>(StringComparer.Ordinal);

            foreach (var group in AllGroups())
            {
                foreach (var (keys, token) in group.Items)
                {
                    foreach (var key in keys) _table[key] = token;
                }
            }
            foreach (var kv in profile.Overrides) _table[kv.Key] = kv.Value;

            _maxTokenLength = _table.Keys.Max(k => k.Length);
        }

        private IEnumerable<(string Title, (string[] Keys, PhoneticToken Token)[] Items)> AllGroups()
        {
            // e/o keys go after u/uu so the keymap reads in alphabet order.
            var profileVowels = _profile.DravidianVowels ? DravidianVowels : NorthVowels;
            yield return ("Vowels", BaseVowels.Take(6).Concat(profileVowels).Concat(BaseVowels.Skip(6)).ToArray());
            yield return ("Consonants", BaseConsonants);
            yield return ("Signs", BaseMarks);
        }

        public bool IsWordChar(char c) =>
            (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '.' || c == '~' || c == '^' || c == '_' || c == '|';

        public string Render(string latinWord) => _mapper.FromDevanagari(RenderDevanagari(latinWord), phonetic: true);

        public string RenderDevanagari(string latinWord)
        {
            var tokens = Tokenize(latinWord);
            var sb = new StringBuilder(latinWord.Length * 2);
            bool pending = false; // last output is a consonant still carrying its inherent vowel

            for (int i = 0; i < tokens.Count; i++)
            {
                var (key, token) = tokens[i];
                switch (token.Kind)
                {
                    case TokenKind.Consonant:
                        if (pending) sb.Append(Virama);
                        sb.Append(_profile.TamilNasal && key == "n" ? TamilN(tokens, i) : token.Text);
                        pending = true;
                        break;

                    case TokenKind.Vowel:
                        sb.Append(pending ? token.Sign : token.Text);
                        pending = false;
                        break;

                    case TokenKind.Modifier:
                        sb.Append(token.Text);
                        pending = false;
                        break;

                    case TokenKind.Virama:
                        if (pending) sb.Append(Virama);
                        pending = false;
                        break;

                    case TokenKind.Separator:
                        pending = false;
                        break;

                    default:
                        if (pending && _profile.FinalVirama) sb.Append(Virama);
                        sb.Append(token.Text);
                        pending = false;
                        break;
                }
            }

            if (pending && _profile.FinalVirama) sb.Append(Virama);
            return sb.ToString();
        }

        private static string TamilN(List<(string Key, PhoneticToken Token)> tokens, int i)
        {
            bool wordStart = i == 0 || tokens[i - 1].Token.Kind is TokenKind.Literal or TokenKind.Separator;
            if (wordStart) return "न";

            if (i + 1 < tokens.Count && tokens[i + 1].Token.Kind == TokenKind.Consonant)
            {
                var next = tokens[i + 1].Token.Text;
                if (next is "त" or "थ" or "द" or "ध") return "न";
            }
            return "ऩ";
        }

        private List<(string Key, PhoneticToken Token)> Tokenize(string s)
        {
            var tokens = new List<(string, PhoneticToken)>();
            int i = 0;
            while (i < s.Length)
            {
                bool matched = false;
                for (int len = Math.Min(_maxTokenLength, s.Length - i); len >= 1; len--)
                {
                    var sub = s.Substring(i, len);
                    if (_table.TryGetValue(sub, out var token))
                    {
                        tokens.Add((sub, token));
                        i += len;
                        matched = true;
                        break;
                    }

                    // Tolerate a capitalised first letter ("Kh", "Ee") when no exact key exists.
                    if (char.IsUpper(sub[0]))
                    {
                        var lowered = char.ToLowerInvariant(sub[0]) + sub.Substring(1);
                        if (_table.TryGetValue(lowered, out token))
                        {
                            tokens.Add((lowered, token));
                            i += len;
                            matched = true;
                            break;
                        }
                    }
                }

                if (!matched)
                {
                    tokens.Add((s[i].ToString(), new PhoneticToken(TokenKind.Literal, s[i].ToString())));
                    i++;
                }
            }
            return tokens;
        }

        public IReadOnlyList<KeymapGroup> Keymap => _keymap ??= BuildKeymap();

        private IReadOnlyList<KeymapGroup> BuildKeymap()
        {
            var groups = new List<KeymapGroup>();
            var shown = new HashSet<string>(StringComparer.Ordinal);

            foreach (var (title, items) in AllGroups())
            {
                var entries = new List<KeymapEntry>();
                foreach (var (keys, _) in items)
                {
                    // Aliases a profile overrode now produce something else, so group keys by output.
                    var byOutput = keys.GroupBy(k => Sample(k));
                    foreach (var g in byOutput)
                    {
                        if (string.IsNullOrEmpty(g.Key)) continue;
                        var label = string.Join(" ", g);
                        if (shown.Add(label + "\u0001" + g.Key)) entries.Add(new KeymapEntry(label, g.Key));
                    }
                }
                groups.Add(new KeymapGroup(title, entries));
            }

            var extra = _profile.Overrides
                .Where(kv => !groups.SelectMany(g => g.Entries).Any(e => e.Keys.Split(' ').Contains(kv.Key)))
                .Select(kv => new KeymapEntry(kv.Key, Sample(kv.Key)))
                .ToList();
            if (extra.Count > 0)
            {
                groups.Insert(2, new KeymapGroup("Special", extra));
            }

            return groups;
        }

        // What a key produces on its own: consonants are shown with the inherent vowel.
        private string Sample(string key)
        {
            var token = _table[key];
            return token.Kind switch
            {
                TokenKind.Consonant => _mapper.FromDevanagari(token.Text, phonetic: false),
                TokenKind.Vowel => _mapper.FromDevanagari(token.Text, phonetic: false),
                TokenKind.Modifier => _mapper.FromDevanagari("◌" + token.Text, phonetic: false),
                TokenKind.Virama => _mapper.FromDevanagari("◌" + Virama, phonetic: false),
                TokenKind.Separator => "(no join)",
                _ => _mapper.FromDevanagari(token.Text, phonetic: false),
            };
        }
    }
}
