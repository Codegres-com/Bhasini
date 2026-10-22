using System.Text;
using System.Text.Json;
using Bhasini.Core.Languages;
using Bhasini.Core.Scripts;
using Bhasini.Web.Site;

namespace Bhasini.SiteGen
{
    // Landing pages for the Translation API, one per search intent: "english to tamil translation api"
    // and "tamil to english translation api" for each of the 22 languages. They are standalone pages
    // (no editor) styled by /api/api.css, linking to the sign-up page at /api/. Every other pair works
    // too, but is covered in the text rather than with hundreds of near-identical pages.
    internal sealed record ApiPage(string Slug, IndicLanguage Language, bool FromEnglish)
    {
        public string Path => "/api/" + Slug + "/";
        public string From => FromEnglish ? "English" : Language.Name;
        public string To => FromEnglish ? Language.Name : "English";
        public string Title => $"{From} to {To} Translation API — IndicTrans2 | Bhasini";
        public string Description => FromEnglish
            ? $"Translate English to {Language.Name} ({Language.NativeName}) with a simple REST API powered by AI4Bharat IndicTrans2. 10,000 free characters, then ₹5 per 10,000. Works with MCP and AI agents."
            : $"Translate {Language.Name} ({Language.NativeName}) to English with a simple REST API. Auto-detects the language, keeps line breaks. 10,000 free characters, then ₹5 per 10,000.";
    }

    internal static class ApiPages
    {
        public const string HubPlaceholder = "<!-- api-language-links: tools/Bhasini.SiteGen puts links to the language pages here at publish time -->";

        public static IReadOnlyList<ApiPage> All { get; } = SitePages.Languages
            .SelectMany(l => new[]
            {
                new ApiPage($"english-to-{SitePages.LanguageSlug(l)}-translation-api", l, FromEnglish: true),
                new ApiPage($"{SitePages.LanguageSlug(l)}-to-english-translation-api", l, FromEnglish: false),
            })
            .ToList();

        private static string H(string s) => Pages.H(s);

        // A real word pair for the example request: a common word if the language has one, otherwise
        // the first example (often the language's own name). Rendered with the engine, as on the typing pages.
        private static (string English, string Native) Example(IndicLanguage l)
        {
            var examples = l.Examples();
            var (keys, meaning) = examples.FirstOrDefault(e => char.IsLower(e.Meaning[0]), examples[0]);
            return (meaning, ScriptConverter.FromRoman(keys, l));
        }

        private static IEnumerable<IndicLanguage> Variants(IndicLanguage l) =>
            LanguageCatalog.All.Where(v => v.Code.StartsWith(l.Code + "-", StringComparison.Ordinal));

        public static string Render(string site, ApiPage page)
        {
            var l = page.Language;
            var (english, native) = Example(l);
            var (text, translation) = page.FromEnglish ? (english, native) : (native, english);
            var target = page.FromEnglish ? l.Code : "en";
            var source = page.FromEnglish ? "en" : l.Code;

            var b = new StringBuilder();
            b.Append($"<nav class=\"crumbs\"><a href=\"/\">Bhasini</a> › <a href=\"/api/\">Translation API</a> › {H(page.From)} to {H(page.To)}</nav>");
            b.Append($"<h1>{H(page.From)} to {H(page.To)} Translation API</h1>");
            b.Append($"<p class=\"lead\">Translate {H(page.From)} to {H(page.To)} ({Pages.Native(l, l.NativeName)}, {H(l.ScriptName)} script) with one HTTPS request. ");
            b.Append(page.FromEnglish
                ? "Powered by AI4Bharat IndicTrans2, the open translation model built for all 22 scheduled languages of India."
                : "Indian-language text is translated by Google Gemma on Cloudflare; leave out the source language and it is detected for you.");
            b.Append("</p>");
            b.Append("<p><a class=\"cta\" href=\"/api/\">Get a free API key</a> &nbsp;<span class=\"muted\">10,000 characters free · no card needed</span></p>");

            b.Append("<h2>Example</h2>");
            b.Append(Code(
                "curl https://mcp.bhasini.com/v1/translate \\\n" +
                "  -H \"Authorization: Bearer YOUR_API_KEY\" \\\n" +
                "  -H \"Content-Type: application/json\" \\\n" +
                $"  -d '{JsonSerializer.Serialize(new { text, source, target }, Pages.Json)}'"));
            b.Append("<p class=\"muted\">Response (abridged):</p>");
            b.Append(Code(JsonSerializer.Serialize(new { translation, source, target, characters = new System.Globalization.StringInfo(text).LengthInTextElements, creditsLeft = 9_990 }, Pages.Json)));

            b.Append("<h3>JavaScript</h3>");
            b.Append(Code(
                $"const text = {JsonSerializer.Serialize(text, Pages.Json)};\n" +
                "const res = await fetch(\"https://mcp.bhasini.com/v1/translate\", {\n" +
                "  method: \"POST\",\n" +
                "  headers: { \"Authorization\": \"Bearer \" + process.env.BHASINI_API_KEY, \"Content-Type\": \"application/json\" },\n" +
                $"  body: JSON.stringify({{ text, target: \"{target}\" }}),\n" +
                "});\n" +
                "const { translation } = await res.json();"));
            b.Append("<h3>Python</h3>");
            b.Append(Code(
                "import os, requests\n\n" +
                $"text = {JsonSerializer.Serialize(text, Pages.Json)}\n" +
                "r = requests.post(\n" +
                "    \"https://mcp.bhasini.com/v1/translate\",\n" +
                "    headers={\"Authorization\": f\"Bearer {os.environ['BHASINI_API_KEY']}\"},\n" +
                $"    json={{\"text\": text, \"target\": \"{target}\"}},\n" +
                ")\n" +
                "print(r.json()[\"translation\"])"));

            b.Append($"<h2>{H(l.Name)} details</h2><table><tbody>");
            b.Append($"<tr><th>Language code</th><td><code>{H(l.Code)}</code></td></tr>");
            b.Append($"<tr><th>Script</th><td>{H(l.ScriptName)}{(l.RightToLeft ? " (right to left)" : "")}</td></tr>");
            foreach (var v in Variants(l)) b.Append($"<tr><th>Also</th><td><code>{H(v.Code)}</code> for {H(v.ScriptName)}</td></tr>");
            b.Append($"<tr><th>Native name</th><td>{Pages.Native(l, l.NativeName)}</td></tr>");
            b.Append($"<tr><th>Model</th><td>{(page.FromEnglish ? "AI4Bharat IndicTrans2 (en-indic 1B)" : "Google Gemma 4 on Cloudflare Workers AI")}</td></tr>");
            b.Append("</tbody></table>");

            b.Append("<h2>Why Bhasini</h2><ul>");
            b.Append($"<li><strong>All 22 languages, done properly.</strong> Including the scripts others skip: Ol Chiki (Santali), Meetei Mayek (Manipuri), Perso-Arabic Kashmiri and Sindhi.</li>");
            b.Append($"<li><strong>Any pair.</strong> {H(l.Name)} to Hindi, Tamil to {H(l.Name)}: Indian-language pairs are translated through English automatically.</li>");
            b.Append("<li><strong>Simple pricing.</strong> 10,000 characters free, then prepaid credits at ₹5 per 10,000 characters, paid by UPI or card through Razorpay.</li>");
            b.Append("<li><strong>For AI agents too.</strong> The same key works with the <a href=\"/mcp/\">Bhasini MCP server</a> for Claude, ChatGPT, Cursor and VS Code.</li>");
            b.Append("<li><strong>Private.</strong> Your text is translated in memory and never stored.</li></ul>");

            b.Append("<h2>Pricing</h2><table><thead><tr><th>Pack</th><th class=\"num\">Price</th><th class=\"num\">Characters</th></tr></thead><tbody>");
            b.Append("<tr><td>Free trial</td><td class=\"num\">₹0</td><td class=\"num\">10,000</td></tr>");
            b.Append("<tr><td>Starter</td><td class=\"num\">₹500</td><td class=\"num\">10,00,000</td></tr>");
            b.Append("<tr><td>Growth</td><td class=\"num\">₹2,000</td><td class=\"num\">44,00,000</td></tr>");
            b.Append("<tr><td>Scale</td><td class=\"num\">₹5,000</td><td class=\"num\">1,20,00,000</td></tr>");
            b.Append("</tbody></table>");
            b.Append("<p><a class=\"cta\" href=\"/api/\">Create your API key</a></p>");

            var faq = Faq(page);
            b.Append(Pages.Faq(faq));

            var reverse = All.First(p => p.Language == l && p.FromEnglish != page.FromEnglish);
            b.Append($"<h2>More</h2><ul class=\"link-grid\"><li><a href=\"{reverse.Path}\">{H(reverse.From)} to {H(reverse.To)} translation API</a></li>");
            b.Append($"<li><a href=\"/{SitePages.LanguageSlug(l)}-typing/\">{H(l.Name)} typing online</a></li>");
            b.Append("<li><a href=\"/mcp/\">MCP server for AI agents</a></li></ul>");
            b.Append($"<h2>Other languages</h2>{Links(page.FromEnglish)}");

            return Shell(site, page.Path, page.Title, page.Description, b.ToString(), JsonLd(site, page, faq), FontHead(l));
        }

        private static string Code(string code) => $"<pre><code>{H(code)}</code></pre>";

        // The Noto font for the page's script (the same families the editor loads), so Ol Chiki, Meetei
        // Mayek and Nastaliq read properly even where the system has no font for them.
        private static readonly Dictionary<string, string> Fonts = new()
        {
            ["script-deva"] = "Noto Sans Devanagari",
            ["script-beng"] = "Noto Sans Bengali",
            ["script-guru"] = "Noto Sans Gurmukhi",
            ["script-gujr"] = "Noto Sans Gujarati",
            ["script-orya"] = "Noto Sans Oriya",
            ["script-taml"] = "Noto Sans Tamil",
            ["script-telu"] = "Noto Sans Telugu",
            ["script-knda"] = "Noto Sans Kannada",
            ["script-mlym"] = "Noto Sans Malayalam",
            ["script-mtei"] = "Noto Sans Meetei Mayek",
            ["script-olck"] = "Noto Sans Ol Chiki",
            ["script-arab-nastaliq"] = "Noto Nastaliq Urdu",
            ["script-arab-naskh"] = "Noto Naskh Arabic",
        };

        private static string FontHead(IndicLanguage l)
        {
            if (!Fonts.TryGetValue(l.FontClass, out var family)) return "";
            return $"<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n" +
                   $"<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family={family.Replace(' ', '+')}:wght@400;600&display=swap\" />\n" +
                   $"<style>.native {{ font-family: '{family}', 'Nirmala UI', sans-serif; }} pre code {{ font-family: Consolas, 'Cascadia Mono', '{family}', monospace; }}</style>";
        }

        private static List<(string, string)> Faq(ApiPage page)
        {
            var l = page.Language;
            return new()
            {
                ($"Is there a free {page.From} to {page.To} translation API?",
                    "Yes. New accounts get 10,000 characters free, and translation without a key is free up to 10,000 characters a day for testing. After that, credits cost ₹5 per 10,000 characters."),
                ($"Which model translates {page.From} to {page.To}?",
                    page.FromEnglish
                        ? $"AI4Bharat IndicTrans2, an open-source model trained for the 22 scheduled languages of India, including {l.Name}. It runs on Cloudflare Workers AI."
                        : $"Google Gemma 4 on Cloudflare Workers AI translates {l.Name} into English. For {l.Name} into another Indian language, the text goes through English and IndicTrans2 writes the result."),
                ($"Can I translate {l.Name} to other Indian languages?",
                    $"Yes. Set \"target\" to any language code, for example \"hi\" for Hindi or \"ta\" for Tamil. Pairs between two Indian languages are translated through English."),
                ("How long can the text be?",
                    "Up to 5,000 characters per request with an API key, and up to 300 requests a minute. Line breaks are kept, so you can send paragraphs."),
                ("Is my text stored?",
                    "No. Text is translated in memory and discarded. Bhasini keeps only character counts for billing."),
                ("How do I pay?",
                    "Buy prepaid credit packs on bhasini.com/api with UPI, cards or net banking through Razorpay. Credits are valid for 12 months."),
            };
        }

        // Links to every page in one direction, for the hub page and the foot of each landing page.
        public static string Links(bool fromEnglish)
        {
            var b = new StringBuilder("<ul class=\"link-grid\">");
            foreach (var p in All.Where(p => p.FromEnglish == fromEnglish))
            {
                b.Append($"<li><a href=\"{p.Path}\">{H(p.From)} to {H(p.To)}</a></li>");
            }
            return b.Append("</ul>").ToString();
        }

        public static string HubLinks() =>
            "<h3>English to Indian languages</h3>" + Links(true) + "<h3>Indian languages to English</h3>" + Links(false);

        private static string JsonLd(string site, ApiPage page, List<(string, string)> faq)
        {
            var graph = new List<object>
            {
                new Dictionary<string, object>
                {
                    ["@type"] = "BreadcrumbList",
                    ["itemListElement"] = new object[]
                    {
                        new Dictionary<string, object> { ["@type"] = "ListItem", ["position"] = 1, ["name"] = "Bhasini", ["item"] = site + "/" },
                        new Dictionary<string, object> { ["@type"] = "ListItem", ["position"] = 2, ["name"] = "Translation API", ["item"] = site + "/api/" },
                        new Dictionary<string, object> { ["@type"] = "ListItem", ["position"] = 3, ["name"] = $"{page.From} to {page.To}", ["item"] = site + page.Path },
                    },
                },
                new Dictionary<string, object>
                {
                    ["@type"] = "SoftwareApplication",
                    ["name"] = $"Bhasini {page.From} to {page.To} Translation API",
                    ["applicationCategory"] = "DeveloperApplication",
                    ["operatingSystem"] = "Any",
                    ["url"] = site + page.Path,
                    ["description"] = page.Description,
                    ["offers"] = new Dictionary<string, object> { ["@type"] = "Offer", ["price"] = "0", ["priceCurrency"] = "INR", ["description"] = "10,000 characters free, then ₹5 per 10,000 characters" },
                    ["creator"] = new Dictionary<string, object> { ["@type"] = "Organization", ["name"] = "Codegres", ["url"] = "https://codegres.com" },
                },
                Pages.FaqLd(faq),
            };
            return JsonSerializer.Serialize(new Dictionary<string, object> { ["@context"] = "https://schema.org", ["@graph"] = graph }, Pages.Json);
        }

        private static string Shell(string site, string path, string title, string description, string body, string jsonLd, string fontHead)
        {
            var t = H(title);
            var d = H(description);
            return $"""
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{t}</title>
                <meta name="description" content="{d}" />
                <meta name="robots" content="index, follow" />
                <link rel="canonical" href="{site}{path}" />
                <link rel="icon" type="image/svg+xml" href="/bhasini-logo.svg" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Bhasini" />
                <meta property="og:title" content="{t}" />
                <meta property="og:description" content="{d}" />
                <meta property="og:url" content="{site}{path}" />
                <meta property="og:image" content="{site}/og-image.jpg" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="{t}" />
                <meta name="twitter:description" content="{d}" />
                <link rel="stylesheet" href="/api/api.css" />
                {fontHead}
                <script type="application/ld+json">{jsonLd}</script>
                </head>
                <body>
                <main>
                {body}
                <p class="muted" style="margin-top:3em"><a href="/api/">Translation API</a> · <a href="/mcp/">MCP server</a> · <a href="/">Bhasini editor</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="mailto:naveen@codegres.com">naveen@codegres.com</a></p>
                </main>
                </body>
                </html>

                """;
        }
    }
}
