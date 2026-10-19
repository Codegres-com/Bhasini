using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Unicode;
using Bhasini.Core.Input;
using Bhasini.Core.Languages;
using Bhasini.Core.Scripts;
using Bhasini.SiteGen;
using Bhasini.Web.Site;

// Writes a static landing page for every search intent in SitePages, plus the sitemap, into a
// published wwwroot. Each page is index.html with its own title and meta tags and readable text
// below the editor, so search engines see real content without running WebAssembly.
//
//   dotnet run --project tools/Bhasini.SiteGen -- publish/wwwroot [https://bhasini.com]

if (args.Length < 1)
{
    Console.Error.WriteLine("usage: Bhasini.SiteGen <published wwwroot> [site url]");
    return 1;
}

var root = Path.GetFullPath(args[0]);
var site = (args.Length > 1 ? args[1] : "https://bhasini.com").TrimEnd('/');
var templatePath = Path.Combine(root, "index.html");
var template = File.ReadAllText(templatePath);
if (!template.Contains(Pages.Placeholder))
{
    Console.Error.WriteLine($"{templatePath} has no '{Pages.Placeholder}' marker. Run the generator on a fresh publish.");
    return 1;
}

// The site's own CSS and JS have fixed names and GitHub Pages caches them for 10 minutes, so a
// visitor could get new WebAssembly with an old editor.js. A content hash in each URL changes
// whenever the file does.
foreach (var asset in new[] { "css/app.css", "js/editor.js", "js/speech.js" })
{
    var bytes = File.ReadAllBytes(Path.Combine(root, asset));
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))[..10].ToLowerInvariant();
    template = Pages.Replace(template, $"\"{asset}\"", $"\"{asset}?v={hash}\"");
}

var duplicate = SitePages.All.GroupBy(p => p.Slug).FirstOrDefault(g => g.Count() > 1);
if (duplicate != null)
{
    Console.Error.WriteLine($"Duplicate page slug: {duplicate.Key}");
    return 1;
}

foreach (var page in SitePages.All)
{
    var html = Pages.Render(template, site, page.Path, page.Title, page.Description, Pages.Body(page), Pages.JsonLd(site, page));
    var dir = Path.Combine(root, page.Slug);
    Directory.CreateDirectory(dir);
    File.WriteAllText(Path.Combine(dir, "index.html"), html);
}

var home = Pages.Render(template, site, "/", null, null, Pages.HomeBody(), Pages.HomeJsonLd(site));
File.WriteAllText(templatePath, home);

// GitHub Pages serves 404.html for unknown paths; it boots the editor but should not be indexed.
var notFound = Pages.Replace(home, "<meta name=\"robots\" content=\"index, follow\" />", "<meta name=\"robots\" content=\"noindex\" />");
File.WriteAllText(Path.Combine(root, "404.html"), notFound);

File.WriteAllText(Path.Combine(root, "sitemap.xml"), Pages.Sitemap(site));

Console.WriteLine($"Wrote {SitePages.All.Count} landing pages, index.html, 404.html and sitemap.xml to {root}");
return 0;

namespace Bhasini.SiteGen
{
    internal static class Pages
    {
        public const string Placeholder = "<!-- site-content: tools/Bhasini.SiteGen puts the page's readable text here at publish time -->";

        // Words to show on each language's pages: romanised keys, English meaning.
        // Rendered with the real engine, so the pages always show what the editor types.
        private static readonly Dictionary<string, (string Keys, string Meaning)[]> ExampleWords = new()
        {
            ["as"] = new[] { ("namaskAr", "hello"), ("dhanyabAd", "thank you"), ("asam", "Assam"), ("guwAhATI", "Guwahati") },
            ["bn"] = new[] { ("namaskAr", "hello"), ("dhanyabAd", "thank you"), ("bhAlobAsA", "love"), ("kalakAtA", "Kolkata") },
            ["brx"] = new[] { ("baRo", "Bodo"), ("kokarAjhAr", "Kokrajhar"), ("bhArat", "India") },
            ["doi"] = new[] { ("DogarI", "Dogri"), ("jammU", "Jammu"), ("bhArat", "India") },
            ["gu"] = new[] { ("namaste", "hello"), ("AbhAr", "thank you"), ("gujarAt", "Gujarat"), ("amadAvAd", "Ahmedabad") },
            ["hi"] = new[] { ("namaste", "hello"), ("dhanyavAd", "thank you"), ("bhArat", "India"), ("dillI", "Delhi") },
            ["kn"] = new[] { ("namaskAra", "hello"), ("dhanyavAdagaLu", "thank you"), ("kannaDa", "Kannada"), ("beMgaLUru", "Bengaluru") },
            ["ks"] = new[] { ("kashur", "Kashmiri"), ("kashIr", "Kashmir") },
            ["kok"] = new[] { ("koMkaNI", "Konkani"), ("namaskAr", "hello"), ("goMy", "Goa") },
            ["mai"] = new[] { ("maithilI", "Maithili"), ("praNAm", "greetings"), ("mithilA", "Mithila") },
            ["ml"] = new[] { ("namaskaaram", "hello"), ("nandi", "thank you"), ("malayaaLam", "Malayalam"), ("kEraLam", "Kerala") },
            ["mni"] = new[] { ("meeteilon", "Manipuri"), ("khurumjari", "greetings"), ("manipur", "Manipur") },
            ["mr"] = new[] { ("namaskAr", "hello"), ("dhanyavAd", "thank you"), ("mahArAShTra", "Maharashtra"), ("puNe", "Pune") },
            ["ne"] = new[] { ("namaste", "hello"), ("dhanyavAd", "thank you"), ("nepAl", "Nepal"), ("kAThamADauM", "Kathmandu") },
            ["or"] = new[] { ("namaskAra", "hello"), ("dhanyabAda", "thank you"), ("o.DishA", "Odisha"), ("bhubaneshwar", "Bhubaneswar") },
            ["pa"] = new[] { ("sat srI akAl", "hello"), ("panjAb", "Punjab"), ("amritasar", "Amritsar") },
            ["sa"] = new[] { ("namaH", "salutation"), ("satyameva jayate", "truth alone triumphs"), ("vasudhaiva kuTumbakam", "the world is one family") },
            ["sat"] = new[] { ("santaRi", "Santali"), ("jOhAr", "greetings") },
            ["sd"] = new[] { ("sindhii", "Sindhi"), ("salaam", "greetings") },
            ["ta"] = new[] { ("vaNakkam", "hello"), ("nanRi", "thank you"), ("thamizh", "Tamil"), ("chennai", "Chennai") },
            ["te"] = new[] { ("namaskAraM", "hello"), ("dhanyavAdAlu", "thank you"), ("telugu", "Telugu"), ("haidarAbAd", "Hyderabad") },
            ["ur"] = new[] { ("aadaab", "greetings"), ("kitaab", "book"), ("urdu", "Urdu") },
        };

        // ---- Page shell ----

        public static string Render(string template, string site, string path, string? title, string? description, string body, string jsonLd)
        {
            var html = template;
            if (title != null)
            {
                var t = Attr(title);
                html = ReplaceRegex(html, @"<title>[^<]*</title>", $"<title>{H(title)}</title>");
                html = ReplaceRegex(html, @"<meta property=""og:title"" content=""[^""]*"" />", $"<meta property=\"og:title\" content=\"{t}\" />");
                html = ReplaceRegex(html, @"<meta name=""twitter:title"" content=""[^""]*"" />", $"<meta name=\"twitter:title\" content=\"{t}\" />");
            }
            if (description != null)
            {
                var d = Attr(description);
                html = ReplaceRegex(html, @"<meta name=""description"" content=""[^""]*"" />", $"<meta name=\"description\" content=\"{d}\" />");
                html = ReplaceRegex(html, @"<meta property=""og:description"" content=""[^""]*"" />", $"<meta property=\"og:description\" content=\"{d}\" />");
                html = ReplaceRegex(html, @"<meta name=""twitter:description"" content=""[^""]*"" />", $"<meta name=\"twitter:description\" content=\"{d}\" />");
            }
            html = ReplaceRegex(html, @"<link rel=""canonical"" href=""[^""]*"" />", $"<link rel=\"canonical\" href=\"{site}{path}\" />");
            html = ReplaceRegex(html, @"<meta property=""og:url"" content=""[^""]*"" />", $"<meta property=\"og:url\" content=\"{site}{path}\" />");
            html = Replace(html, "</head>", $"    <script type=\"application/ld+json\">{jsonLd}</script>\n</head>");
            html = Replace(html, Placeholder, $"<div class=\"site-content\">\n{body}\n    </div>");
            return html;
        }

        public static string Replace(string html, string find, string with)
        {
            int at = html.IndexOf(find, StringComparison.Ordinal);
            if (at < 0 || html.IndexOf(find, at + find.Length, StringComparison.Ordinal) >= 0)
            {
                throw new InvalidOperationException($"Expected exactly one '{find}' in index.html");
            }
            return html[..at] + with + html[(at + find.Length)..];
        }

        private static string ReplaceRegex(string html, string pattern, string with)
        {
            var matches = Regex.Matches(html, pattern);
            if (matches.Count != 1) throw new InvalidOperationException($"Expected exactly one match for {pattern} in index.html");
            return html[..matches[0].Index] + with + html[(matches[0].Index + matches[0].Length)..];
        }

        // ---- Bodies ----

        public static string Body(SitePage page) => page.Kind switch
        {
            SitePageKind.Typing => TypingBody(page.Language!),
            SitePageKind.EnglishTo => EnglishToBody(page.Language!),
            SitePageKind.Keyboard => KeyboardBody(page.Language!),
            SitePageKind.VoiceTyping => VoiceBody(page.Language!),
            SitePageKind.ScriptConverter => ConverterBody(),
            _ => throw new ArgumentOutOfRangeException(nameof(page)),
        };

        private static string TypingBody(IndicLanguage l)
        {
            var b = new StringBuilder();
            b.Append($"<h1>{H(l.Name)} Typing Online {Native(l, l.NativeName)}</h1>");
            b.Append($"<p class=\"lead\">Type {H(l.Name)} in the {H(l.ScriptName)} script for free, right in your browser. Type words the way they sound in English letters (<code>{H(l.SampleInput)}</code> becomes {Native(l, l.Sample)})");
            b.Append(l.SupportsInscript ? ", or use the government-standard InScript layout." : ".");
            b.Append(" There is nothing to install, and your text never leaves your device.</p>");
            b.Append(StartTyping(l));

            b.Append($"<h2>How to type in {H(l.Name)}</h2><ol>");
            b.Append($"<li>The editor above is already set to {H(l.Name)}. Click in it and start typing.</li>");
            b.Append($"<li><strong>Phonetic:</strong> spell each word as it sounds. The whole word is redrawn as you type, so <code>{H(FirstWord(l.SampleInput))}</code> turns into {Native(l, l.Phonetic!.Render(FirstWord(l.SampleInput)))} letter by letter.</li>");
            if (l.SupportsInscript) b.Append($"<li><strong>InScript:</strong> if you learned the standard Indian keyboard, switch to InScript and type {H(l.ScriptName)} letters directly.</li>");
            b.Append($"<li>Press <strong>F9</strong> to switch between {H(l.Name)} and English without leaving the editor.</li>");
            b.Append("<li>Copy the text, or save it as Word (.docx), plain text or a web page.</li></ol>");

            b.Append($"<h2>{H(l.Name)} typing examples</h2>");
            b.Append(ExampleTable(l));

            b.Append("<h2>Tips</h2><ul>");
            if (l.Phonetic is BrahmicPhoneticEngine)
            {
                b.Append("<li>Capitals type the long and retroflex sounds: <code>A I U E O</code>, <code>T D N L Sh</code>.</li>");
                b.Append("<li><code>M</code> types the anusvara, <code>H</code> the visarga, and <code>.h</code> an explicit virama.</li>");
                b.Append("<li>Use <code>_</code> to stop two letters from joining.</li>");
            }
            b.Append($"<li>Open the <strong>Keys</strong> panel to see every {H(l.ScriptName)} letter and the keys that type it. Tap a letter to insert it, which also helps on phones.</li>");
            if (l.DigitMapper != null) b.Append($"<li>Turn on native digits to type {Native(l, string.Concat(Enumerable.Range(1, 3).Select(d => l.NativeDigit(d))))} instead of 123.</li>");
            foreach (var variant in Variants(l))
            {
                b.Append($"<li>{H(l.Name)} is also written in {H(variant.ScriptName)}: choose <strong>{H(variant.Name)}</strong> in the language list.</li>");
            }
            b.Append("</ul>");

            b.Append(Faq(TypingFaq(l)));
            b.Append(Related(l, SitePageKind.Typing));
            return b.ToString();
        }

        private static string EnglishToBody(IndicLanguage l)
        {
            var b = new StringBuilder();
            b.Append($"<h1>English to {H(l.Name)} Typing</h1>");
            b.Append($"<p class=\"lead\">Type {H(l.Name)} using English letters and see it appear in {H(l.ScriptName)} script as you type. Write <code>{H(l.SampleInput)}</code> and get {Native(l, l.Sample)}. Free, instant, and private.</p>");
            b.Append(StartTyping(l));

            b.Append($"<h2>How English to {H(l.Name)} typing works</h2>");
            b.Append($"<p>This is <em>transliteration</em>: you spell {H(l.Name)} words with the English alphabet and Bhasini writes the same sounds in {H(l.ScriptName)}. It does not translate English words into {H(l.Name)}. Type <code>{H(l.Examples().First().Keys)}</code>, not \"{H(l.Examples().First().Meaning)}\".</p>");
            b.Append("<p>Each word is redrawn on every key, so combinations like <code>kh</code>, <code>aa</code> and <code>ksh</code> form the right letter automatically.</p>");

            b.Append($"<h2>English to {H(l.Name)} examples</h2>");
            b.Append(ExampleTable(l));

            var vowels = l.Phonetic!.Keymap.FirstOrDefault();
            if (vowels != null)
            {
                b.Append($"<h2>{H(vowels.Title)}: English keys to {H(l.ScriptName)}</h2>");
                b.Append(KeyGrid(l, vowels.Entries));
                b.Append($"<p>See every letter on the <a href=\"/{SitePages.LanguageSlug(l)}-keyboard/\">{H(l.Name)} keyboard</a> page.</p>");
            }

            b.Append(Faq(new List<(string, string)>
            {
                ($"Is this English to {l.Name} translation?",
                    $"No. Bhasini converts the sounds you type into {l.ScriptName} letters (transliteration). To write a {l.Name} word, spell how it sounds in {l.Name}."),
                ($"Can I convert English-letter text I already have?",
                    $"Yes. Paste it into the editor, click Convert, choose \"Romanised text → native script\" and pick {l.Name}."),
                ($"Does English to {l.Name} typing work on mobile?",
                    "Yes. It works in any modern phone browser, and you can add Bhasini to your home screen like an app."),
                ("Is it free?", "Yes, Bhasini is free and needs no sign-up."),
            }));
            b.Append(Related(l, SitePageKind.EnglishTo));
            return b.ToString();
        }

        private static string KeyboardBody(IndicLanguage l)
        {
            var b = new StringBuilder();
            b.Append($"<h1>{H(l.Name)} Keyboard {Native(l, l.NativeName)}</h1>");
            b.Append($"<p class=\"lead\">An online {H(l.Name)} keyboard for the {H(l.ScriptName)} script. Type with your own keyboard, or open the <strong>Keys</strong> panel above and tap letters. ");
            b.Append(l.SupportsInscript ? "Both the phonetic and the InScript layout are shown below." : "The full phonetic key chart is below.");
            b.Append("</p>");
            b.Append(StartTyping(l));

            b.Append($"<h2>Phonetic {H(l.Name)} keyboard</h2>");
            b.Append($"<p>Type the keys on the right of each letter. Letters combine into syllables on their own as you type.</p>");
            foreach (var group in l.Phonetic!.Keymap)
            {
                b.Append($"<h3>{H(group.Title)}</h3>");
                b.Append(KeyGrid(l, group.Entries));
            }

            if (l.SupportsInscript)
            {
                b.Append($"<h2>{H(l.Name)} InScript keyboard layout</h2>");
                b.Append("<p>InScript is the Government of India standard layout, the same on every Indian script. The small letter on each key needs Shift.</p>");
                b.Append("<div class=\"inscript\">");
                foreach (var (row, shiftRow) in InscriptLayout.Rows.Zip(InscriptLayout.ShiftRows))
                {
                    b.Append("<div class=\"inscript-line\">");
                    for (int i = 0; i < row.Length; i++)
                    {
                        b.Append($"<div><span class=\"up {l.FontClass}\">{H(Inscript(l, shiftRow[i]))}</span><span class=\"lo {l.FontClass}\">{H(Inscript(l, row[i]))}</span><code>{H(row[i].ToString())}</code></div>");
                    }
                    b.Append("</div>");
                }
                b.Append("</div>");
            }

            b.Append(Faq(new List<(string, string)>
            {
                ("Which layout should I use?", l.SupportsInscript
                    ? "Phonetic is easiest if you think in English letters. InScript is faster once learned and is the layout used in government typing tests."
                    : "Use the phonetic keys: type each sound in English letters."),
                ($"Can I use the {l.Name} keyboard on my phone?", "Yes. Open the Keys panel and tap letters, or type with your phone's English keyboard."),
                ($"Can I type {l.Name} in other apps?", "Copy from here into any app. On Windows, the Bhasini app's Global mode types in every application with F9."),
            }));
            b.Append(Related(l, SitePageKind.Keyboard));
            return b.ToString();
        }

        private static string VoiceBody(IndicLanguage l)
        {
            var b = new StringBuilder();
            b.Append($"<h1>{H(l.Name)} Voice Typing {Native(l, l.NativeName)}</h1>");
            b.Append($"<p class=\"lead\">Speak {H(l.Name)} and watch it appear as {H(l.ScriptName)} text. Correct any word with the {H(l.Name)} keyboard, then copy it or save it as a Word document.</p>");
            b.Append(StartTyping(l));

            b.Append($"<h2>How to use {H(l.Name)} voice typing</h2><ol>");
            b.Append("<li>Open this page in Chrome or Edge, on a computer or an Android phone.</li>");
            b.Append("<li>Click <strong>Speak</strong> above the editor and allow the microphone.</li>");
            b.Append($"<li>Speak naturally in {H(l.Name)}. Each sentence is added where your cursor is.</li>");
            b.Append($"<li>Click <strong>Stop</strong>, fix any word by typing (<code>{H(l.SampleInput)}</code> → {Native(l, l.Sample)}), and save.</li></ol>");
            b.Append("<p>Voice typing uses your browser's speech recognition (Google in Chrome, Microsoft in Edge), which processes the audio under that provider's privacy policy. Everything you type stays on your device.</p>");

            b.Append(Faq(new List<(string, string)>
            {
                ("Which browsers support voice typing?", "Chrome and Edge. Other browsers may not support speech recognition for this language; you can still type."),
                ($"Is {l.Name} voice typing free?", "Yes. There is no sign-up and no limit."),
                ("Why is the Speak button missing?", "Your browser has no speech recognition. Open the page in Chrome or Edge."),
            }));
            b.Append(Related(l, SitePageKind.VoiceTyping));
            return b.ToString();
        }

        private static string ConverterBody()
        {
            const string sample = "नमस्ते भारत";
            var b = new StringBuilder();
            b.Append("<h1>Indian Script Converter</h1>");
            b.Append("<p class=\"lead\">Rewrite text from one Indian script into another: Devanagari to Tamil, Kannada to Telugu, Bengali to Gujarati, Gurmukhi to Malayalam and more. It also turns romanised text such as <code>namaste</code> into any Indian script.</p>");
            b.Append("<a class=\"start-typing\" href=\"#app\">Open the converter ↑</a>");

            b.Append($"<h2>One sentence in every script</h2><p>\"{H(sample)}\" (namaste bhaarat) converted by Bhasini:</p>");
            b.Append("<table><thead><tr><th>Script</th><th>Text</th></tr></thead><tbody>");
            foreach (var l in LanguageCatalog.All.Where(ScriptConverter.CanConvertTo).GroupBy(l => l.ScriptName).Select(g => g.First()))
            {
                b.Append($"<tr><td>{H(l.ScriptName)}</td><td>{Native(l, ScriptConverter.ConvertScript(sample, l))}</td></tr>");
            }
            b.Append("</tbody></table>");

            b.Append("<h2>How to convert text between scripts</h2><ol>");
            b.Append("<li>Paste or type your text in the editor above.</li>");
            b.Append("<li>Select part of it, or select nothing to convert the whole document.</li>");
            b.Append("<li>Click <strong>Convert</strong>, choose the target script and press Convert.</li></ol>");

            b.Append(Faq(new List<(string, string)>
            {
                ("Does this translate the text?", "No. It changes the letters, not the language: Hindi written in Tamil script is still Hindi."),
                ("What happens to sounds a script does not have?", "They use the nearest letter. Tamil, for example, has no separate letters for aspirated sounds."),
                ("Can I convert to Urdu or Ol Chiki?", "Script conversion covers the Brahmic scripts and Meetei Mayek. To write Urdu, Kashmiri, Sindhi or Santali, type phonetically or use \"Romanised text → native script\"."),
            }));

            b.Append("<h2>Type in any Indian language</h2>");
            b.Append(LanguageLinks());
            return b.ToString();
        }

        public static string HomeBody()
        {
            var b = new StringBuilder();
            b.Append("<h1>Type in all 22 Indian languages</h1>");
            b.Append("<p class=\"lead\">Bhasini is a free online editor for every scheduled language of India: Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Maithili, Santali, Kashmiri, Nepali, Sindhi, Konkani, Dogri, Manipuri, Bodo and Sanskrit. Type phonetically or with InScript, convert between scripts and save as Word. Everything runs in your browser.</p>");
            b.Append("<a class=\"start-typing\" href=\"#app\">Start typing ↑</a>");

            b.Append("<h2>Choose your language</h2>");
            b.Append(LanguageLinks());

            b.Append("<h2>English to Indian language typing</h2><ul class=\"link-grid\">");
            foreach (var p in SitePages.All.Where(p => p.Kind == SitePageKind.EnglishTo))
            {
                b.Append($"<li><a href=\"{p.Path}\">English to {H(p.Language!.Name)}<small>{H(p.Language.SampleInput)} → <span class=\"{p.Language.FontClass}\">{H(p.Language.Sample)}</span></small></a></li>");
            }
            b.Append("</ul>");

            b.Append("<h2>Keyboards</h2><ul class=\"link-grid\">");
            foreach (var p in SitePages.All.Where(p => p.Kind == SitePageKind.Keyboard))
            {
                b.Append($"<li><a href=\"{p.Path}\">{H(p.Language!.Name)} keyboard<small>{H(p.Language.ScriptName)}</small></a></li>");
            }
            b.Append("</ul>");

            b.Append("<h2>Voice typing and tools</h2><ul class=\"link-grid\">");
            foreach (var p in SitePages.All.Where(p => p.Kind == SitePageKind.VoiceTyping))
            {
                b.Append($"<li><a href=\"{p.Path}\">{H(p.Language!.Name)} voice typing</a></li>");
            }
            b.Append("<li><a href=\"/indian-script-converter/\">Indian script converter</a></li>");
            b.Append("<li><a href=\"/mcp/\">MCP server for AI assistants<small>Claude, ChatGPT Codex, Cursor</small></a></li></ul>");

            b.Append(Faq(new List<(string, string)>
            {
                ("Is Bhasini free?", "Yes. Bhasini is free, needs no account, and has no ads."),
                ("Which languages can I type?", "All 22 languages of the Eighth Schedule of the Constitution of India, plus English, including the extra official scripts for Kashmiri, Manipuri and Sindhi."),
                ("Is my text private?", "Yes. Typing and conversion run on your device. Nothing you type is sent to Bhasini or anyone else."),
                ("Can I type in Word, WhatsApp or Gmail?", "Copy from Bhasini into any app. On Windows, the Bhasini app's Global mode types any Indian language in every application with F9."),
            }));
            return b.ToString();
        }

        // ---- Building blocks ----

        private static string StartTyping(IndicLanguage l) => $"<a class=\"start-typing\" href=\"#app\">Start typing {H(l.Name)} ↑</a>";

        private static string ExampleTable(IndicLanguage l)
        {
            var b = new StringBuilder("<table><thead><tr><th>You type</th><th>You get</th><th>Meaning</th></tr></thead><tbody>");
            foreach (var (keys, meaning) in l.Examples())
            {
                b.Append($"<tr><td><code>{H(keys)}</code></td><td>{Native(l, ScriptConverter.FromRoman(keys, l))}</td><td>{H(meaning)}</td></tr>");
            }
            return b.Append("</tbody></table>").ToString();
        }

        private static string KeyGrid(IndicLanguage l, IEnumerable<KeymapEntry> entries)
        {
            var b = new StringBuilder("<div class=\"key-grid\">");
            foreach (var e in entries)
            {
                b.Append($"<div><span class=\"out {l.FontClass}\" dir=\"auto\">{H(e.Output)}</span><code>{H(e.Keys)}</code></div>");
            }
            return b.Append("</div>").ToString();
        }

        private static string Faq(IEnumerable<(string Q, string A)> items)
        {
            var b = new StringBuilder("<h2>Frequently asked questions</h2>");
            foreach (var (q, a) in items) b.Append($"<details><summary>{H(q)}</summary><p>{H(a)}</p></details>");
            return b.ToString();
        }

        private static List<(string, string)> TypingFaq(IndicLanguage l) => new()
        {
            ($"Is {l.Name} typing on Bhasini free?", "Yes. Bhasini is free, needs no account, and has no ads."),
            ($"How do I type {l.Name} on my phone?", "Open this page in your phone's browser and type with the English keyboard, or tap letters in the Keys panel. You can add Bhasini to your home screen."),
            ($"Can I type {l.Name} in WhatsApp, Word or Gmail?", $"Type here and copy. On Windows, the Bhasini app's Global mode types {l.Name} in every application with F9."),
            ("Is my text private?", "Yes. Typing runs on your device and nothing you type is sent anywhere."),
        };

        private static readonly Dictionary<SitePageKind, string> KindLabels = new()
        {
            [SitePageKind.Typing] = "typing",
            [SitePageKind.EnglishTo] = "English to {0} typing",
            [SitePageKind.Keyboard] = "keyboard",
            [SitePageKind.VoiceTyping] = "voice typing",
        };

        private static string Related(IndicLanguage l, SitePageKind current)
        {
            var b = new StringBuilder($"<h2>More for {H(l.Name)}</h2><ul class=\"link-grid\">");
            foreach (var p in SitePages.All.Where(p => p.Language == l && p.Kind != current))
            {
                var label = p.Kind == SitePageKind.EnglishTo ? $"English to {l.Name} typing" : $"{l.Name} {KindLabels[p.Kind]}";
                b.Append($"<li><a href=\"{p.Path}\">{H(label)}</a></li>");
            }
            b.Append("<li><a href=\"/indian-script-converter/\">Indian script converter</a></li></ul>");
            b.Append("<h2>Other Indian languages</h2>");
            b.Append(LanguageLinks());
            return b.ToString();
        }

        private static string LanguageLinks()
        {
            var b = new StringBuilder("<ul class=\"link-grid\">");
            foreach (var l in SitePages.Languages)
            {
                b.Append($"<li><a href=\"/{SitePages.LanguageSlug(l)}-typing/\"><span class=\"{l.FontClass}\" dir=\"auto\">{H(l.NativeName)}</span><small>{H(l.Name)} typing</small></a></li>");
            }
            return b.Append("</ul>").ToString();
        }

        private static IEnumerable<IndicLanguage> Variants(IndicLanguage l) =>
            LanguageCatalog.All.Where(v => v.Code.StartsWith(l.Code + "-", StringComparison.Ordinal));

        private static (string Keys, string Meaning)[] Examples(this IndicLanguage l) =>
            ExampleWords.TryGetValue(l.Code, out var list) ? list : new[] { (l.SampleInput, l.Name) };

        private static string Inscript(IndicLanguage l, char key)
        {
            var deva = InscriptLayout.Map(key);
            return deva == null || l.Mapper == null ? "" : l.Mapper.FromDevanagari(deva, phonetic: false);
        }

        private static string FirstWord(string s) => s.Split(' ')[0];

        private static string Native(IndicLanguage l, string text) =>
            $"<span class=\"native {l.FontClass}\" dir=\"auto\" lang=\"{l.Code}\">{H(text)}</span>";

        private static string H(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

        private static string Attr(string s) => H(s);

        // ---- Structured data ----

        private static readonly JsonSerializerOptions Json = new()
        {
            Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
        };

        public static string JsonLd(string site, SitePage page)
        {
            var faq = page.Kind switch
            {
                SitePageKind.Typing => TypingFaq(page.Language!),
                _ => null,
            };
            var graph = new List<object>
            {
                new Dictionary<string, object>
                {
                    ["@type"] = "BreadcrumbList",
                    ["itemListElement"] = new object[]
                    {
                        new Dictionary<string, object> { ["@type"] = "ListItem", ["position"] = 1, ["name"] = "Bhasini", ["item"] = site + "/" },
                        new Dictionary<string, object> { ["@type"] = "ListItem", ["position"] = 2, ["name"] = page.Title.Split(" | ")[0], ["item"] = site + page.Path },
                    },
                },
            };
            if (faq != null) graph.Add(FaqLd(faq));
            return JsonSerializer.Serialize(new Dictionary<string, object> { ["@context"] = "https://schema.org", ["@graph"] = graph }, Json);
        }

        public static string HomeJsonLd(string site) => JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["@context"] = "https://schema.org",
            ["@type"] = "ItemList",
            ["name"] = "Indian language typing",
            ["itemListElement"] = SitePages.All.Where(p => p.Kind == SitePageKind.Typing).Select((p, i) => new Dictionary<string, object>
            {
                ["@type"] = "ListItem", ["position"] = i + 1, ["name"] = p.Language!.Name + " typing", ["url"] = site + p.Path,
            }).ToArray(),
        }, Json);

        private static object FaqLd(IEnumerable<(string Q, string A)> items) => new Dictionary<string, object>
        {
            ["@type"] = "FAQPage",
            ["mainEntity"] = items.Select(i => new Dictionary<string, object>
            {
                ["@type"] = "Question",
                ["name"] = i.Q,
                ["acceptedAnswer"] = new Dictionary<string, object> { ["@type"] = "Answer", ["text"] = i.A },
            }).ToArray(),
        };

        // ---- Sitemap ----

        public static string Sitemap(string site)
        {
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var b = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
            void Url(string path, string freq, string priority) =>
                b.Append($"  <url>\n    <loc>{site}{path}</loc>\n    <lastmod>{today}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{priority}</priority>\n  </url>\n");

            Url("/", "weekly", "1.0");
            foreach (var p in SitePages.All)
            {
                Url(p.Path, "monthly", p.Kind switch
                {
                    SitePageKind.Typing => "0.9",
                    SitePageKind.EnglishTo or SitePageKind.Keyboard => "0.8",
                    _ => "0.7",
                });
            }
            Url("/mcp/", "monthly", "0.6");
            Url("/privacy.html", "yearly", "0.3");
            return b.Append("</urlset>\n").ToString();
        }
    }
}
