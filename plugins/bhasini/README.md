# Bhasini Indic Languages plugin

Gives Claude exact, rule-based tools for writing all **22 scheduled languages of India**:
transliterate romanised text into native scripts, convert text between Indian scripts, translate
between English and these languages, look up phonetic keyboard maps and write native digits. It uses the same engine as [bhasini.com](https://bhasini.com),
which is especially useful for scripts models often misspell, such as Ol Chiki (Santali), Meetei Mayek
(Manipuri) and Perso-Arabic Kashmiri and Sindhi.

Works in Claude on the web, desktop and mobile, in Cowork and in Claude Code. Nothing to install and no
account needed.

## What's inside

- **MCP server `bhasini`**: the hosted Bhasini server at `https://mcp.bhasini.com/mcp` (Streamable HTTP, no
  authentication). Tools: `list_languages`, `transliterate`, `convert_script`, `get_keymap`, `native_digits`,
  `translate`. All are read-only.
- **Skill `indic-text`**: tells Claude when to use those tools instead of writing Indic letters from memory.

## What it runs, sends and fetches

- Runs nothing on your computer. The plugin only connects Claude to the hosted server.
- Sends the arguments of each tool call (the text to convert and a language code) to
  `https://mcp.bhasini.com/mcp`, which runs on Cloudflare Workers. It never receives your conversation.
  Text sent to `translate` is translated by Cloudflare Workers AI and not stored.
- Fetches nothing else.

Prefer to keep everything on your machine? The same server is available as a local .NET tool (offline except `translate`):
[Bhasini.Mcp on NuGet](https://www.nuget.org/packages/Bhasini.Mcp) (`dnx Bhasini.Mcp@0.2.0 --yes`).

## Example prompts

- "Write 'Happy Diwali, from the Sharma family' in Hindi, Tamil and Bengali scripts."
- "Convert this Hindi paragraph into Kannada script."
- "How do I type ழ on a Tamil phonetic keyboard?"
- "Translate 'Where is the railway station?' into Tamil."

## Privacy Policy

- **Data collection:** no personal data, telemetry or analytics. The hosted server receives only the text and
  language code passed to each tool call.
- **Usage and storage:** that text is processed in memory to produce the result and is not stored or logged.
  `translate` passes the text to Cloudflare Workers AI (AI4Bharat IndicTrans2 and Google Gemma) to run the
  translation; we do not store the text or the translation, and Workers AI does not use it to train models.
- **Third-party sharing:** the server runs on Cloudflare Workers. Cloudflare handles the connection, including
  your IP address, which is used only to limit each client to 120 requests a minute (5 for `translate`) and,
  as a one-way hash, to count each client's free translation characters for the day (10,000). Request
  metadata such as time and status may appear in Cloudflare's operational logs. Nothing is shared with
  anyone else.
- **Data retention:** tool-call text is not retained after the response is sent. The daily translation
  counter holds only a number and is deleted shortly after midnight IST.
- **Contact:** naveen@codegres.com · full policy at https://bhasini.com/privacy.html

## License

MIT © Codegres
