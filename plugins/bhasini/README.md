# Bhasini Indic Languages plugin

Gives Claude exact, rule-based tools for writing all **22 scheduled languages of India**:
transliterate romanised text into native scripts, convert text between Indian scripts, look up
phonetic keyboard maps and write native digits. It uses the same engine as [bhasini.com](https://bhasini.com),
which is especially useful for scripts models often misspell, such as Ol Chiki (Santali), Meetei Mayek
(Manipuri) and Perso-Arabic Kashmiri and Sindhi.

## What's inside

- **MCP server `bhasini`**: the [Bhasini.Mcp](https://www.nuget.org/packages/Bhasini.Mcp) package, version 0.1.0, started with `dnx Bhasini.Mcp@0.1.0 --yes`. Tools: `list_languages`, `transliterate`, `convert_script`, `get_keymap`, `native_digits`. All are read-only.
- **Skill `indic-text`**: tells Claude when to use those tools instead of writing Indic letters from memory.

## Requirements

The [.NET 10 SDK](https://dotnet.microsoft.com/download) or later, which provides the `dnx` command.
On first use, `dnx` downloads the pinned Bhasini.Mcp package from NuGet.org. After that it runs offline.

## What it runs, sends and fetches

- Runs the Bhasini.Mcp server locally over stdio.
- Fetches the Bhasini.Mcp package (and nothing else) from NuGet.org the first time it starts.
- Sends nothing anywhere: the server makes no network requests and keeps no data.

## Example prompts

- "Write 'Happy Diwali, from the Sharma family' in Hindi, Tamil and Bengali scripts."
- "Convert this Hindi paragraph into Kannada script."
- "How do I type ழ on a Tamil phonetic keyboard?"

## Privacy Policy

- **Data collection:** none. No personal data, telemetry or analytics.
- **Usage and storage:** text passed to the tools is processed in memory on your computer and discarded when the call returns.
- **Third-party sharing:** none. The server makes no network requests.
- **Data retention:** none.
- **Contact:** naveen@codegres.com · https://bhasini.com/privacy.html

## License

MIT © Codegres
