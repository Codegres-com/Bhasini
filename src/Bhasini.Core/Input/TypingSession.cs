using System.Text;
using Bhasini.Core.Languages;

namespace Bhasini.Core.Input
{
    public enum InputMethod
    {
        Phonetic,
        Inscript,
        English
    }

    // An edit for the editor to apply at the caret: delete Delete characters before it, then insert.
    public sealed record KeyResult(int Delete, string Insert);

    // Keystroke state for one editor. Holds the Latin keys of the word being typed and the text
    // they produced, so each key replaces only the part of the word that changed.
    public sealed class TypingSession
    {
        private readonly StringBuilder _word = new();
        private string _output = "";

        public IndicLanguage Language { get; private set; } = LanguageCatalog.Default;

        public InputMethod Method { get; private set; } = InputMethod.Phonetic;

        public bool NativeDigits { get; set; }

        public bool IsActive => !Language.IsEnglish && Method != InputMethod.English;

        public void SetLanguage(IndicLanguage language)
        {
            Language = language;
            if (Method == InputMethod.Inscript && !language.SupportsInscript) Method = InputMethod.Phonetic;
            Reset();
        }

        public void SetMethod(InputMethod method)
        {
            Method = method == InputMethod.Inscript && !Language.SupportsInscript ? InputMethod.Phonetic : method;
            Reset();
        }

        public void Reset()
        {
            _word.Clear();
            _output = "";
        }

        // Null means "not handled": let the editor insert the key itself.
        public KeyResult? Key(char key)
        {
            if (!IsActive) return null;

            if (Method == InputMethod.Inscript)
            {
                Reset();
                var deva = InscriptLayout.Map(key);
                if (deva != null) return new KeyResult(0, Language.Mapper!.FromDevanagari(deva, phonetic: false));
                return NonWordKey(key);
            }

            var phonetic = Language.Phonetic!;
            if (phonetic.IsWordChar(key))
            {
                _word.Append(key);
                return Rerender();
            }

            Reset();
            return NonWordKey(key);
        }

        public KeyResult? Backspace()
        {
            if (!IsActive || _word.Length == 0) return null;

            _word.Length--;
            if (_word.Length == 0)
            {
                var result = new KeyResult(_output.Length, "");
                _output = "";
                return result;
            }
            return Rerender();
        }

        private KeyResult? NonWordKey(char key)
        {
            if (key >= '0' && key <= '9' && NativeDigits)
            {
                var digit = Language.NativeDigit(key - '0');
                if (digit != null) return new KeyResult(0, digit.Value.ToString());
            }
            return Language.Punctuation.TryGetValue(key, out var mark) ? new KeyResult(0, mark) : null;
        }

        private KeyResult Rerender()
        {
            var output = Language.Phonetic!.Render(_word.ToString());
            int common = 0;
            int max = Math.Min(output.Length, _output.Length);
            while (common < max && output[common] == _output[common]) common++;

            var result = new KeyResult(_output.Length - common, output.Substring(common));
            _output = output;
            return result;
        }
    }
}
