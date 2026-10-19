# Bhasini MCP server: build, publish and submit

Status: **local server, package, plugin, docs page and remote (Cloudflare Worker) server built and tested locally. Nothing published or deployed yet.** · 19 Oct 2026

## What exists in the repo

| Piece | Path | What it is |
|---|---|---|
| MCP server | `src/Bhasini.Mcp/` | C# stdio server on the [MCP C# SDK](https://www.nuget.org/packages/ModelContextProtocol) 2.2.0, reusing `Bhasini.Core`. Five read-only tools: `list_languages`, `transliterate`, `convert_script`, `get_keymap`, `native_digits` |
| NuGet / .NET tool package | `dotnet pack src/Bhasini.Mcp` | `Bhasini.Mcp` 0.1.0, package type `McpServer`, command `bhasini-mcp`, includes `README.md` (with the `mcp-name` marker and Privacy Policy) and `.mcp/server.json` |
| Registry manifest | `src/Bhasini.Mcp/.mcp/server.json` | Official MCP Registry entry `io.github.codegres-com/bhasini` |
| Claude plugin | `plugins/bhasini/` | Plugin manifest + `.mcp.json` (`dnx Bhasini.Mcp@0.1.0 --yes`) + `indic-text` skill + README + LICENSE. Passes `claude plugin validate` |
| Static docs page | `src/Bhasini.Web/wwwroot/mcp/index.html` → **https://bhasini.com/mcp/** | Install instructions for every client. In the sitemap and linked from the home page |
| Release workflow | `.github/workflows/publish-mcp.yml` | On tag `mcp-vX.Y.Z`: test → pack → push to NuGet → publish to the MCP Registry |
| **Remote MCP server** | `workers/bhasini-mcp/` → **https://mcp.bhasini.com/mcp** | Cloudflare Worker, Streamable HTTP, no auth, CORS, 64 KB request cap, 120 requests/min per IP. TypeScript port of `Bhasini.Core`; tool definitions are exported from the C# server so both list identical tools |
| Parity fixtures | `tools/Bhasini.FixtureGen` | Exports `src/generated/tools.json`, `src/generated/unassigned.json` and ~52,000 C# input/output cases to `test/fixtures.json` (gitignored) |
| Worker CI/CD | `.github/workflows/mcp-worker.yml` | Regenerates fixtures from C#, fails if generated files are stale, typechecks, runs the tests, and deploys from `main` when `CLOUDFLARE_API_TOKEN` is set |

Tested:
- **Local server:** every tool over stdio (Tamil, Kannada, Sanskrit, Santali digits, Meetei Mayek keymap, error cases), and an install of the packed tool.
- **Remote server:** the TypeScript port reproduces all 24,428 transliteration and 27,720 script-conversion cases, plus every keymap, language list and digit case, exactly as C# does. A deliberately injected bug was caught (641 cases failed). 14 HTTP tests cover the endpoint, and under `wrangler dev` the official MCP Inspector (`@modelcontextprotocol/inspector` 2.9.0) listed the tools and ran `transliterate`. The rate limit started returning 429 after 120 requests.

**Not tested:** `dnx` (needs .NET 10, not installed here), loading the plugin in Claude (the package isn't on NuGet yet), and a real Cloudflare deployment (needs your Cloudflare login).

---

## Why GitHub Pages can't be the MCP endpoint, and why a Worker can

MCP over HTTP needs an endpoint that **runs code on each request**: it reads a JSON-RPC `POST`, calls a
tool and writes a JSON reply.

- **GitHub Pages is a static file host.** It returns files for `GET` and has no way to run your code. A `POST` gets an error, whatever the URL.
- **Blazor runs in the visitor's browser, not on the server.** The C# engine on bhasini.com is downloaded as WebAssembly and runs on the user's device, so there is nothing on the server side to answer an AI assistant's request.
- **Cloudflare is currently DNS-only for bhasini.com** (responses say `Server: GitHub.com`). In that mode Cloudflare only answers "which IP is bhasini.com?" and never sees the HTTP request, so it can't run anything either.
- **A Cloudflare Worker is that missing piece:** a small serverless function that runs at Cloudflare's edge for a hostname you assign. With no server to manage, it runs only when called and scales automatically. The free plan includes 100,000 requests a day. Putting it on its own subdomain, **mcp.bhasini.com**, leaves the GitHub Pages site exactly as it is.

| Distribution | Needs a backend? | Who can use it |
|---|---|---|
| **Local server** (built) | **No.** It runs on the user's computer | Claude Desktop, Claude Code, Cowork (via plugin), OpenAI Codex CLI/IDE, Cursor, VS Code, Windsurf, any MCP client |
| **Remote server** (built: Cloudflare Worker at `https://mcp.bhasini.com/mcp`) | **A serverless function, no server to run** | Everything above, **plus** claude.ai web and mobile, and ChatGPT web, desktop and mobile |

**Both directories, Claude Connectors and ChatGPT Apps, list remote servers only.** Claude has one
exception: a local server can be listed when it is wrapped in a **plugin**, which we have.

---

## Step 1: publish the package (one-time setup)

1. Create a NuGet.org account under Codegres, make an API key scoped to `Bhasini.Mcp`, and save it as the repository secret `NUGET_API_KEY`.
2. Push the code, then tag a release:
   ```bash
   git tag mcp-v0.1.0
   ```
   ```bash
   git push origin mcp-v0.1.0
   ```
3. The workflow pushes to NuGet, waits for validation, and publishes `server.json` to the
   [Official MCP Registry](https://registry.modelcontextprotocol.io/). The registry feeds the GitHub
   MCP Registry, VS Code's MCP gallery and other catalogs.

When you bump the version, update `<Version>` in the csproj, both versions in `server.json`, the
pinned version in `plugins/bhasini/.mcp.json`, and `version` in `plugin.json`. The workflow checks
the first four.

---

## Step 2: submit to Claude

### Route A: plugin bundle (works now, no backend)
1. Use a **paid Claude plan**. Open the developer portal at **https://claude.ai/directory/manage**.
2. Connect your GitHub account on claude.ai (it must have push access to `Codegres-com/Bhasini`).
3. **Submit new → Plugin bundle**. Repository: `Codegres-com/Bhasini`, plugin path: `plugins/bhasini`, branch: `main`.
4. **Validate**, fix any blocking findings, answer **Data handling** (no personal data, no data sent elsewhere, no retention), complete **Compliance**, then **Submit for review**.
5. Expect a **reviewer hold**: any plugin that starts a package from a registry (our `dnx Bhasini.Mcp@0.1.0`) is always checked by a person. That's normal, not a rejection.
6. Once it passes, select **Publish**. People then add it from claude.ai and use it in chat, Cowork and Claude Code.

Tips:
- Run `claude plugin validate ./plugins/bhasini` before every push. It currently passes.
- The name "bhasini" may be held as **"Name matches a known brand"** because of the government's BHASHINI. Be ready to explain the difference, or rename it (e.g. `bhasini-indic`).
- Optionally move the plugin to its own repository root. Subfolder plugins get stricter script checks.

### Route B: MCP connector (remote server, after deploying it)
Same portal, **Submit new → MCP connector**, paste the `https://` URL. It requires a `title` and
`readOnlyHint`/`destructiveHint` on every tool (already done), a privacy policy URL
(`https://bhasini.com/privacy.html`), a docs URL (`https://bhasini.com/mcp/`), a support contact and an
icon. Authentication can be **none**, because the tools touch no user data. After an automated scan,
it is listed as a Community connector by default. Escalations: `mcp-review@anthropic.com`.

If you do both, Anthropic recommends submitting the server as a connector and pairing it with the plugin.

---

## Step 3: submit to OpenAI (ChatGPT / Codex)

ChatGPT's directory (now "Plugins", shared by ChatGPT and Codex) **requires a remote server** with a
"stable, public HTTPS endpoint". There is no static or local route into ChatGPT itself.

**Today, without a backend:** Codex users can already add the local server (`~/.codex/config.toml`,
shown on bhasini.com/mcp/). OpenAI mentions a desktop-only path for approved local MCP plugins, but
its details aren't public, so don't plan around it.

**With the remote server (once deployed):**
1. In the OpenAI Platform, complete **business verification** for Codegres (Organization settings). Only owners, or members with *Apps Management Write*, can submit.
2. Prepare four public HTTPS URLs from the same publisher: website (`https://bhasini.com`), support, privacy policy and **terms of service**. *We don't have a terms page yet, so it must be written.*
3. Build the plugin ZIP with `mcp.json` pointing at `https://mcp.bhasini.com/mcp`, auth type `none`. Keep `displayName` and `shortDescription` to 30 characters or fewer (e.g. "Bhasini" / "Indian language scripts"). Icon: square PNG/SVG, at least 48×48.
4. Upload at **https://platform.openai.com/plugins → Upload new or existing plugin**, connect the server, and wait for the automated tool scan.
5. **Domain verification:** host the challenge token as plain text at `https://bhasini.com/.well-known/openai-apps-challenge`. The static site can do this: add the file under `wwwroot/.well-known/` (GitHub Pages serves it because `.nojekyll` is set).
6. Review details: **5 positive and 3 negative test cases** (e.g. positive: "write namaste in Tamil script" → `transliterate`; negative: "translate this English sentence to Tamil" should *not* claim to translate), a **demo video URL**, and release notes. No reviewer account is needed because there is no auth.
7. **Submit for review**. Feedback arrives by email. After approval, select **Publish plugin**. Server changes are re-scanned daily.

---

## Deploy the remote server (Cloudflare Worker)

The Worker is in `workers/bhasini-mcp/`. Its `wrangler.toml` already declares the custom domain
`mcp.bhasini.com`, the free `workers.dev` URL and the rate limiter.

**One-time, from your machine:**
```bash
cd workers/bhasini-mcp
```
```bash
npm ci
```
```bash
npx wrangler login
```
```bash
npm run deploy
```

- The **custom domain** only works if the `bhasini.com` zone is on the same Cloudflare account. It is, because your DNS is there. Cloudflare creates the `mcp` DNS record and certificate itself, and bhasini.com stays DNS-only on GitHub Pages.
- Until then, or as a fallback, the Worker is also live at `https://bhasini-mcp.<your-account>.workers.dev/mcp`.
- Check it: `https://mcp.bhasini.com/health` returns `{"status":"ok"}`, and opening `https://mcp.bhasini.com/mcp` in a browser redirects to the docs.

**Automatic deploys:** in GitHub → Settings → Secrets and variables → Actions, add
`CLOUDFLARE_API_TOKEN` (create it in the Cloudflare dashboard with the *Edit Cloudflare Workers*
template) and `CLOUDFLARE_ACCOUNT_ID`. Every push to `main` that touches the engine or the Worker
then tests and deploys it.

**Local development:** `npm run dev` serves `http://127.0.0.1:8787/mcp`. `npm test` runs the HTTP
tests and the C# parity tests. Run `npm run fixtures` first, which needs the .NET 8 SDK.

**Keeping C# and TypeScript in step:** the C# engine (`src/Bhasini.Core`) is the reference. After
changing it, run `npm run fixtures` and `npm test`. CI fails if the port drifts, or if the generated
tool definitions weren't regenerated.

### Connect to the remote server
| Client | How |
|---|---|
| claude.ai / Claude Desktop | Settings → Connectors → **Add custom connector** → `https://mcp.bhasini.com/mcp` |
| Claude Code | `claude mcp add --transport http bhasini https://mcp.bhasini.com/mcp` |
| ChatGPT | Turn on developer mode in ChatGPT's settings, then add a custom app/connector with the URL (until it's listed in the directory) |
| OpenAI Codex (`~/.codex/config.toml`) | `[mcp_servers.bhasini]` with `url = "https://mcp.bhasini.com/mcp"` |
| VS Code (`.vscode/mcp.json`) | `{"servers": {"bhasini": {"type": "http", "url": "https://mcp.bhasini.com/mcp"}}}` |
| Cursor and other JSON configs | `{"mcpServers": {"bhasini": {"url": "https://mcp.bhasini.com/mcp"}}}` |

No authentication and no user data keep both directory reviews simple.

---

## Checklist before any submission
- [ ] Publish `Bhasini.Mcp` 0.1.0 to NuGet and the MCP Registry (Step 1)
- [ ] Install via `dnx` on a machine with .NET 10 and run each tool from Claude Desktop and Claude Code
- [ ] Load `plugins/bhasini` in Claude Code (`/plugin`) and check that the skill triggers
- [ ] Icon: a square PNG version of `bhasini-logo.svg`
- [ ] Terms of service page (needed for OpenAI)
- [ ] Deploy the Worker (`npx wrangler login`, `npm run deploy`) and check `https://mcp.bhasini.com/health`
- [ ] Add the remote URL as a custom connector in Claude and in ChatGPT developer mode, and run each tool
- [ ] OpenAI domain token at `src/Bhasini.Web/wwwroot/.well-known/openai-apps-challenge` (content from the OpenAI portal)
- [ ] Trademark check on the name (see `LANGUAGE_API_PLAN.md` §2)

## Sources
- Claude: [Submit a connector](https://claude.com/docs/connectors/building/submission), [Submit a plugin](https://claude.com/docs/plugins/submit), [Plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
- OpenAI: [Submitting apps to the ChatGPT directory](https://help.openai.com/en/articles/20001040-submitting-apps-to-the-chatgpt-app-directory), [Apps SDK submission](https://developers.openai.com/apps-sdk/deploy/submission), [Developers can now submit apps](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)
- MCP Registry: [Publish a .NET MCP server to the registry](https://learn.microsoft.com/en-us/dotnet/ai/quickstarts/publish-mcp-registry), [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/)
