namespace Bhasini.Core.Scripts
{
    public enum Script
    {
        Latin,
        Devanagari,
        Bengali,
        Gurmukhi,
        Gujarati,
        Odia,
        Tamil,
        Telugu,
        Kannada,
        Malayalam,
        MeeteiMayek,
        OlChiki,
        PersoArabic
    }

    // Converts text written in "Devanagari space" into a target script and back.
    // Every Brahmic engine in Bhasini (phonetic and InScript) produces Devanagari first, so a
    // single mapper per script is all a language needs to be typeable.
    public interface IScriptMapper
    {
        Script Script { get; }

        // phonetic = true applies the script's spelling conventions for typed words
        // (Malayalam chillus, Gurmukhi tippi/addak, Bengali ya-shruti); conversion leaves them off.
        string FromDevanagari(string deva, bool phonetic);

        string ToDevanagari(string text);

        bool Owns(char c);

        char NativeDigit(int digit);
    }
}
