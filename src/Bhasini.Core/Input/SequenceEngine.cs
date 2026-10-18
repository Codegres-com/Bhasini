using System.Text;

namespace Bhasini.Core.Input
{
    // One key sequence's output, optionally different at the start or end of a word
    // (Perso-Arabic vowels: "a" is ا initially, unwritten inside a word).
    public sealed record SequenceEntry(string Medial, string? Initial = null, string? Final = null);

    // Greedy longest-match transliteration for alphabetic scripts (Perso-Arabic, Ol Chiki).
    public sealed class SequenceEngine : ITransliterator
    {
        private readonly Dictionary<string, SequenceEntry> _map;
        private readonly int _maxLength;
        private readonly (string Title, string[] Keys)[] _groups;
        private IReadOnlyList<KeymapGroup>? _keymap;

        public SequenceEngine(Dictionary<string, SequenceEntry> map, (string Title, string[] Keys)[] groups)
        {
            _map = new Dictionary<string, SequenceEntry>(map, StringComparer.Ordinal);
            _maxLength = _map.Keys.Max(k => k.Length);
            _groups = groups;
        }

        public bool IsWordChar(char c) =>
            (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '\'' || c == '~' || c == ':';

        public string Render(string latinWord)
        {
            var tokens = new List<(string Key, SequenceEntry? Entry)>();
            int i = 0;
            while (i < latinWord.Length)
            {
                bool matched = false;
                for (int len = Math.Min(_maxLength, latinWord.Length - i); len >= 1; len--)
                {
                    var sub = latinWord.Substring(i, len);
                    if (!_map.TryGetValue(sub, out var entry) && char.IsUpper(sub[0]))
                    {
                        sub = char.ToLowerInvariant(sub[0]) + sub.Substring(1);
                        _map.TryGetValue(sub, out entry);
                    }
                    if (entry != null)
                    {
                        tokens.Add((sub, entry));
                        i += len;
                        matched = true;
                        break;
                    }
                }
                if (!matched)
                {
                    tokens.Add((latinWord[i].ToString(), null));
                    i++;
                }
            }

            var sb = new StringBuilder();
            for (int t = 0; t < tokens.Count; t++)
            {
                var (key, entry) = tokens[t];
                if (entry == null)
                {
                    sb.Append(key);
                    continue;
                }

                if (t == 0) sb.Append(entry.Initial ?? entry.Medial);
                else if (t == tokens.Count - 1) sb.Append(entry.Final ?? entry.Medial);
                else sb.Append(entry.Medial);
            }
            return sb.ToString();
        }

        public IReadOnlyList<KeymapGroup> Keymap => _keymap ??= _groups
            .Select(g => new KeymapGroup(g.Title, g.Keys
                .Where(_map.ContainsKey)
                .Select(k =>
                {
                    var e = _map[k];
                    var text = e.Medial.Length > 0 ? e.Medial : (e.Initial ?? e.Final ?? "");
                    var note = e.Initial != null && e.Initial != text ? "start " + e.Initial : null;
                    return new KeymapEntry(k, text, note);
                })
                .ToList()))
            .ToList();
    }
}
