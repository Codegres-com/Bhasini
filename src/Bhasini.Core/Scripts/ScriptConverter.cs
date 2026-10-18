using System.Text;
using Bhasini.Core.Languages;

namespace Bhasini.Core.Scripts
{
    public static class ScriptConverter
    {
        public static bool CanConvertTo(IndicLanguage target) => target.Mapper != null;

        // Rewrites text in any Brahmic script (or Meetei Mayek) into the target language's script.
        // Characters of other scripts are kept as they are.
        public static string ConvertScript(string text, IndicLanguage target)
        {
            if (string.IsNullOrEmpty(text) || target.Mapper == null) return text;

            var result = new StringBuilder(text.Length);
            int i = 0;
            while (i < text.Length)
            {
                var source = ScriptMappers.Sources.FirstOrDefault(m => m.Owns(text[i]));
                int start = i;
                while (i < text.Length && (source == null ? Owner(text[i]) == null : source.Owns(text[i]) || IsJoiner(text[i])))
                {
                    i++;
                }

                var run = text.Substring(start, i - start);
                if (source == null || source == target.Mapper)
                {
                    result.Append(run);
                }
                else
                {
                    result.Append(target.Mapper.FromDevanagari(source.ToDevanagari(run), phonetic: false));
                }
            }
            return result.ToString();
        }

        // Transliterates romanised words (e.g. pasted "namaste") with the language's phonetic scheme.
        public static string FromRoman(string text, IndicLanguage target)
        {
            if (string.IsNullOrEmpty(text) || target.Phonetic == null) return text;

            var phonetic = target.Phonetic;
            var result = new StringBuilder(text.Length * 2);
            int i = 0;
            while (i < text.Length)
            {
                if (char.IsAsciiLetter(text[i]))
                {
                    int start = i;
                    while (i < text.Length && phonetic.IsWordChar(text[i])) i++;
                    result.Append(phonetic.Render(text.Substring(start, i - start)));
                }
                else
                {
                    result.Append(target.Punctuation.TryGetValue(text[i], out var mark) ? mark : text[i].ToString());
                    i++;
                }
            }
            return result.ToString();
        }

        private static IScriptMapper? Owner(char c) => ScriptMappers.Sources.FirstOrDefault(m => m.Owns(c));

        private static bool IsJoiner(char c) => c == '‌' || c == '‍' || c == '।' || c == '॥';
    }
}
