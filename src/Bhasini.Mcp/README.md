# Bhasini MCP: Indian languages for AI assistants

<!-- mcp-name: io.github.Codegres-com/bhasini -->

An [MCP](https://modelcontextprotocol.io) server that gives Claude, ChatGPT (Codex), Cursor, VS Code and
other MCP clients exact, rule-based tools for all **22 scheduled languages of India**. It uses the same
engine as [bhasini.com](https://bhasini.com). It runs on your computer; only `translate` makes a network call.

Language models often get Indic spelling wrong, especially in scripts like Ol Chiki (Santali),
Meetei Mayek (Manipuri) or Perso-Arabic Kashmiri and Sindhi. These tools give the model a
deterministic answer instead of a guess.

## Tools

| Tool | What it does | Example |
|---|---|---|
| `list_languages` | Languages, codes and scripts the other tools accept | `hi`, `ta`, `sat`, `mni`, `ks`, … |
| `transliterate` | Romanised text → native script, by sound | `vaNakkam` + `ta` → வணக்கம் |
| `convert_script` | One Indian script → another, letter by letter | नमस्ते + `kn` → ನಮಸ್ತೇ |
| `get_keymap` | Phonetic keyboard map for a language | which keys type ൾ, ಳ, ꯂ, … |
| `native_digits` | ASCII digits → native digits | 2026 + `hi` → २०२६ |
| `translate` | Meaning between English and 22 languages, or between two of them (AI4Bharat IndicTrans2) | "Where is the station?" + `hi` → स्टेशन कहाँ है? |

All tools are read-only. All but `translate` work offline; `translate` calls
`https://mcp.bhasini.com/v1/translate` (set `BHASINI_TRANSLATE_URL` to use another deployment).

**Prefer nothing to install?** The same tools are hosted at `https://mcp.bhasini.com/mcp` and listed in
[Claude's connector directory](https://claude.ai/directory/bhasini).

## Install

Requires the .NET SDK. `dnx` comes with .NET 10 or later; `dotnet tool` works with .NET 8 or later.

**Claude Desktop, Claude Code, Cursor, Windsurf** (any client with a JSON `mcpServers` config):

```json
{
  "mcpServers": {
    "bhasini": {
      "command": "dnx",
      "args": ["Bhasini.Mcp", "--yes"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add bhasini -- dnx Bhasini.Mcp --yes
```

**OpenAI Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.bhasini]
command = "dnx"
args = ["Bhasini.Mcp", "--yes"]
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "bhasini": { "type": "stdio", "command": "dnx", "args": ["Bhasini.Mcp", "--yes"] }
  }
}
```

**With .NET 8 or 9:** run `dotnet tool install -g Bhasini.Mcp`, then use `"command": "bhasini-mcp"` with no args.

## Example prompts

- "Write 'Happy Diwali, from the Sharma family' in Hindi, Tamil and Bengali scripts."
- "Convert this Hindi paragraph into Kannada script so my grandmother can read it aloud."
- "What keys do I press to type ழ in Tamil?"
- "Write the Santali greeting 'johar' in Ol Chiki."

## Privacy Policy

- **Data collection:** none. The server collects no personal data, telemetry or analytics.
- **Usage and storage:** text sent to the tools is processed in memory on your computer and discarded when the call returns. Nothing is written to disk.
- **Third-party sharing:** only for `translate`, which sends the text to mcp.bhasini.com, where Cloudflare Workers AI translates it; neither stores it. The other tools make no network requests. Your MCP client (for example Claude or ChatGPT) handles the conversation under its own privacy policy.
- **Data retention:** none. No data is kept after a tool call returns.
- **Contact:** naveen@codegres.com · full policy at https://bhasini.com/privacy.html

## License

MIT © Codegres. Source: https://github.com/Codegres-com/Bhasini
