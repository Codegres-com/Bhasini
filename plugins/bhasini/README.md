# Bhasini Indic Languages plugin

Gives Claude exact, rule-based tools for writing all **22 scheduled languages of India**:
transliterate romanised text into native scripts, convert text between Indian scripts, look up
phonetic keyboard maps and write native digits. It uses the same engine as [bhasini.com](https://bhasini.com),
which is especially useful for scripts models often misspell, such as Ol Chiki (Santali), Meetei Mayek
(Manipuri) and Perso-Arabic Kashmiri and Sindhi.

Works in Claude on the web, desktop and mobile, in Cowork and in Claude Code. Nothing to install and no
account needed.

## What's inside

- **MCP server `bhasini`**: the hosted Bhasini server at `https://mcp.bhasini.com/mcp` (Streamable HTTP, no
  authentication). Tools: `list_languages`, `transliterate`, `convert_script`, `get_keymap`, `native_digits`.
  All are read-only.
- **Skill `indic-text`**: tells Claude when to use those tools instead of writing Indic letters from memory.

## What it runs, sends and fetches

- Runs nothing on your computer. The plugin only connects Claude to the hosted server.
- Sends the arguments of each tool call (the text to convert and a language code) to
  `https://mcp.bhasini.com/mcp`, which runs on Cloudflare Workers. It never receives your conversation.
- Fetches nothing else.

Prefer to keep everything on your machine? The same server is available as a local, offline .NET tool:
[Bhasini.Mcp on NuGet](https://www.nuget.org/packages/Bhasini.Mcp) (`dnx Bhasini.Mcp@0.1.0 --yes`).

## Example prompts

- "Write 'Happy Diwali, from the Sharma family' in Hindi, Tamil and Bengali scripts."
- "Convert this Hindi paragraph into Kannada script."
- "How do I type ழ on a Tamil phonetic keyboard?"

## Privacy Policy

- **Data collection:** no personal data, telemetry or analytics. The hosted server receives only the text and
  language code passed to each tool call.
- **Usage and storage:** that text is processed in memory to produce the result and is not stored or logged.
- **Third-party sharing:** the server runs on Cloudflare Workers. Cloudflare handles the connection, including
  your IP address, which is used only to limit each client to 120 requests a minute. Request metadata such as
  time and status may appear in Cloudflare's operational logs. Nothing is shared with anyone else.
- **Data retention:** tool-call text is not retained after the response is sent.
- **Contact:** naveen@codegres.com · full policy at https://bhasini.com/privacy.html

## License

MIT © Codegres
