using Bhasini.Core.Input;
using Bhasini.Core.Languages;
using Bhasini.Core.Scripts;
using Xunit;

namespace Bhasini.Core.Tests
{
    public class TransliterationTests
    {
        private static string Type(string code, string text, InputMethod method = InputMethod.Phonetic)
        {
            var session = new TypingSession();
            session.SetLanguage(LanguageCatalog.Get(code));
            session.SetMethod(method);

            var doc = new System.Text.StringBuilder();
            foreach (var c in text)
            {
                var r = session.Key(c);
                if (r == null)
                {
                    doc.Append(c);
                    continue;
                }
                doc.Length -= r.Delete;
                doc.Append(r.Insert);
            }
            return doc.ToString();
        }

        [Theory]
        [InlineData("as", "namaskAr", "নমস্কাৰ")]
        [InlineData("bn", "namaskAr bAMlA", "নমস্কার বাংলা")]
        [InlineData("brx", "baRo", "बड़ो")]
        [InlineData("doi", "DogarI", "डोगरी")]
        [InlineData("gu", "namaste gujarAtI", "નમસ્તે ગુજરાતી")]
        [InlineData("hi", "namaste hindI", "नमस्ते हिन्दी")]
        [InlineData("hi", "kamal", "कमल")]
        [InlineData("hi", "kShatriya", "क्षत्रिय")]
        [InlineData("hi", "zindagI", "ज़िन्दगी")]
        [InlineData("kn", "namaskAra kannaDa", "ನಮಸ್ಕಾರ ಕನ್ನಡ")]
        [InlineData("kn", "kannaD", "ಕನ್ನಡ್")]
        [InlineData("kn", "beLe", "ಬೆಳೆ")]
        [InlineData("kn", "kRShNa", "ಕೃಷ್ಣ")]
        [InlineData("ks", "kashur", "کشر")]
        [InlineData("kok", "koMkaNI", "कोंकणी")]
        [InlineData("mai", "maithilI", "मैथिली")]
        [InlineData("ml", "malayaaLam", "മലയാളം")]
        [InlineData("ml", "avan", "അവൻ")]
        [InlineData("ml", "ente manushyan", "എന്റെ മനുഷ്യൻ")]
        [InlineData("ml", "enthu", "എന്തു")]
        [InlineData("mni", "meeteilon", "ꯃꯤꯇꯩꯂꯣꯟ")]
        [InlineData("mr", "marAThI", "मराठी")]
        [InlineData("mr", "shALA", "शाळा")]
        [InlineData("ne", "nepAlI", "नेपाली")]
        [InlineData("or", "o.DiA", "ଓଡ଼ିଆ")]
        [InlineData("pa", "panjAbI", "ਪੰਜਾਬੀ")]
        [InlineData("pa", "pakkA", "ਪੱਕਾ")]
        [InlineData("sa", "saMskRtam", "संस्कृतम्")]
        [InlineData("sat", "santaRi", "ᱥᱟᱱᱛᱟᱲᱤ")]
        [InlineData("sd", "sindhii", "سنڌي")]
        [InlineData("ta", "vaNakkam thamizh", "வணக்கம் தமிழ்")]
        [InlineData("ta", "avan", "அவன்")]
        [InlineData("ta", "nanRi", "நன்றி")]
        [InlineData("ta", "sol", "சொல்")]
        [InlineData("hi", "kRiShNa", "कृष्ण")]
        [InlineData("te", "telugu", "తెలుగు")]
        [InlineData("ur", "aadaab urdu", "آداب اردو")]
        [InlineData("ur", "hai", "ہے")]
        public void PhoneticTypingProducesNativeText(string code, string input, string expected)
        {
            Assert.Equal(expected, Type(code, input));
        }

        [Theory]
        [InlineData("hi", "kfjl", "किरत")]   // InScript: क ि र त
        [InlineData("kn", "kfjl", "ಕಿರತ")]
        [InlineData("ta", "kfjl", "கிரத")]
        public void InscriptMapsAcrossScripts(string code, string input, string expected)
        {
            Assert.Equal(expected, Type(code, input, InputMethod.Inscript));
        }

        [Fact]
        public void BackspaceRewindsTheWordBuffer()
        {
            var session = new TypingSession();
            session.SetLanguage(LanguageCatalog.Get("hi"));
            var doc = "";
            foreach (var c in "kaa")
            {
                var r = session.Key(c)!;
                doc = doc[..^r.Delete] + r.Insert;
            }
            Assert.Equal("का", doc);

            var b = session.Backspace()!;
            doc = doc[..^b.Delete] + b.Insert;
            Assert.Equal("क", doc);
        }

        [Fact]
        public void EveryScheduledLanguageIsTypeable()
        {
            Assert.Equal(22, LanguageCatalog.ScheduledLanguageCount);
            foreach (var lang in LanguageCatalog.All.Where(l => !l.IsEnglish))
            {
                var output = Type(lang.Code, "ka");
                Assert.False(string.IsNullOrEmpty(output));
                Assert.DoesNotContain("k", output);
                Assert.NotEmpty(lang.Phonetic!.Keymap);
            }
        }

        [Theory]
        [InlineData("नमस्ते", "kn", "ನಮಸ್ತೇ")]
        [InlineData("ನಮಸ್ಕಾರ", "hi", "नमस्कार")]
        [InlineData("नमस्ते", "ta", "நமஸ்தே")]
        [InlineData("राम", "as", "ৰাম")]
        public void ConvertsBetweenScripts(string input, string target, string expected)
        {
            Assert.Equal(expected, ScriptConverter.ConvertScript(input, LanguageCatalog.Get(target)));
        }
    }
}
