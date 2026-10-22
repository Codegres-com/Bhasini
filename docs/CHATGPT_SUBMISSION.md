# ChatGPT submission kit: Bhasini

Everything needed to submit the hosted Bhasini MCP server (`https://mcp.bhasini.com/mcp`) to the
ChatGPT / Codex plugin directory. Prepared 19 Oct 2026 against OpenAI's
[submission guide](https://developers.openai.com/apps-sdk/deploy/submission). Check it again before
uploading, because the requirements change.

| Piece | Where |
|---|---|
| Upload package (manifest, MCP config, onboarding skill, logo) | [`docs/chatgpt-plugin/`](chatgpt-plugin/) |
| Manifest generator + limit checker + zipper | [`tools/chatgpt-plugin/build_manifest.py`](../tools/chatgpt-plugin/build_manifest.py) |
| This guide: listing text, test cases, video script, steps | here |

All example outputs below were checked against the live server.

---

## 1. Before you start (your side)

- [ ] **Business verification** for Codegres: OpenAI Platform → Organization settings. Required to publish under the company name, and it can take days, so start first.
- [ ] Your account is an **organization owner** or has **Apps Management Write**.
- [ ] Record the **demo video** (script in §5), upload it as unlisted on YouTube or Drive with link sharing, and paste the URL into `DEMO_VIDEO_URL` in `build_manifest.py`.
- [ ] Optional but recommended: try it yourself in ChatGPT developer mode with the server URL, and run all five positive prompts.

Already done: the server is live, and the website, support, privacy and terms URLs all return 200.
There is no login, so no reviewer account is needed.

---

## 2. Listing text (inside `plugin.json`)

| Field | Value | Limit |
|---|---|---|
| `displayName` | Bhasini Indic Scripts | 21 / 30 |
| `shortDescription` | Spell words in Indian scripts | 29 / 30 |
| `developerName` | Codegres | 8 / 80 |
| `category` | Productivity | dashboard category |
| `longDescription` | see below | 1,751 / 4,000 |
| `websiteURL` / `supportURL` | https://bhasini.com/mcp/ | |
| `privacyPolicyURL` | https://bhasini.com/privacy.html | |
| `termsOfServiceURL` | https://bhasini.com/terms.html | |
| `defaultPrompt` | "Write vaNakkam and nanRi in Tamil script" · "Translate 'Where is the railway station?' into Tamil" · "Write the Santali word johar in Ol Chiki" | 3 × ≤128 |
| `capabilities` | 5 short lines (transliterate, convert scripts, translate, keyboard keys, native digits) | ≤20 × ≤120 |
| `logo`, `composerIcon` | `assets/logo.png` (512 × 512, square) | ≥48 px, ≤5 MiB |
| `brandColor` | #F07B2B (Bhasini saffron) | |
| Commerce | No | |
| Countries | All (`[]`) | |

**Long description**

> Bhasini Indic Scripts writes and translates text in the 22 scheduled languages of India: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu and Urdu.
>
> Spelling uses a rule-based transliteration engine, so the same input always gives the same spelling. It covers less widely supported scripts too, such as Ol Chiki (Santali), Meetei Mayek (Manipuri) and Perso-Arabic Kashmiri and Sindhi.
>
> What you can ask:
> - Write words in a native script: "Write vaNakkam and nanRi in Tamil script" gives வணக்கம், நன்றி.
> - Convert text between Indian scripts: Hindi नमस्ते भारत becomes Kannada ನಮಸ್ತೇ ಭಾರತ, so a reader of one script can read text written in another.
> - Translate between English and any of the 22 languages, or between two of them: "Where is the railway station?" becomes Tamil ரயில் நிலையம் எங்கே?
> - Learn to type: find the keys for any letter on a phonetic keyboard, such as zh for ழ in Tamil.
> - Write numbers in native numerals: 2026 becomes २०२६ in Hindi or ২০২৬ in Bengali.
> - Look up the supported languages, scripts and language codes.
>
> Transliteration writes the sounds of words in another script; translation carries their meaning into another language. Translation runs AI4Bharat IndicTrans2 and Google Gemma on Cloudflare Workers AI, for up to 2,000 characters a request and 10,000 characters a day.
>
> No account or sign-in is needed. Bhasini receives only the text passed to its tools, never your conversation. That text is processed in memory and is not stored or logged. See the privacy policy for details.
>
> Made by Codegres. The engine is open source under the MIT license at github.com/Codegres-com/Bhasini.

To change any of this, edit `build_manifest.py` and re-run it. Don't hand-edit `plugin.json`.

---

## 3. Test cases (exactly 5 positive and 3 negative)

Run every positive case yourself before submitting. OpenAI asks you to.

### Positive

| # | Prompt | Tool | Expected (verified on the live server) |
|---|---|---|---|
| 1 | Write the Tamil words vaNakkam and nanRi in Tamil script. | `transliterate` (ta) | வணக்கம் and நன்றி |
| 2 | Rewrite नमस्ते भारत in Kannada script so a Kannada reader can read it aloud. | `convert_script` (kn) | ನಮಸ್ತೇ ಭಾರತ, noting the words are still Hindi |
| 3 | Which keys do I press to type ழ on a Tamil phonetic keyboard? | `get_keymap` (ta) | `zh` (or `Lx`) |
| 4 | Write the year 2026 in Devanagari numerals and in Bengali numerals. | `native_digits` (hi, bn) | २०२६ and ২০২৬ |
| 5 | Translate 'Where is the railway station?' into Tamil. | `translate` (ta) | ரயில் நிலையம் எங்கே? |

### Negative (the plugin should not act, or must not be misused)

| # | Prompt | Why / expected |
|---|---|---|
| 1 | Translate 'Bonjour, comment ça va ?' into English. | French to English: Bhasini only translates to and from the 22 Indian languages, so no tool. ChatGPT translates itself. |
| 2 | Write a Python function that reverses a string. | Unrelated; no Bhasini tool. |
| 3 | What's the weather in Chennai today? | Mentions an Indian city but needs weather data Bhasini doesn't have; no tool. |

---

## 4. Upload steps

**No video yet?** Build a draft package and upload it now, to run the portal's metadata checks and
tool scan early. Run from the repo root:
```bash
python tools/chatgpt-plugin/build_manifest.py --draft
```
This writes `artifacts/bhasini-chatgpt-plugin-draft.zip`, the same package without `demo_recording_url`.
It can't be submitted for review: once the video exists, set the URL and build the real package with `--zip`.

1. Set `DEMO_VIDEO_URL` in `tools/chatgpt-plugin/build_manifest.py`, then build the package from the repo root:
   ```bash
   python tools/chatgpt-plugin/build_manifest.py --zip
   ```
   This checks every limit and writes `artifacts/bhasini-chatgpt-plugin.zip`, with the files at the zip root and forward-slash paths. Don't use PowerShell 5.1's `Compress-Archive`: it writes backslash paths.
2. Go to **https://platform.openai.com/plugins → Upload new or existing plugin**, choose the verified Codegres identity, and upload the zip.
3. Fix any **Metadata & Skills** findings in `build_manifest.py`, re-run step 1 and re-upload.
4. **Connect the MCP server.** Authentication: **None**. Wait for the automated tool scan. All six tools are read-only and annotated. `translate` is marked open-world because it sends text to Cloudflare Workers AI.
5. **Domain verification:** the portal gives a challenge token. Create
   `src/Bhasini.Web/wwwroot/.well-known/openai-apps-challenge` containing **only the token** (plain text, no
   newline needed), then commit and push. GitHub Pages serves it at
   `https://bhasini.com/.well-known/openai-apps-challenge`. bhasini.com is an eligible parent domain of mcp.bhasini.com.
   (The .NET SDK normally skips dot-folders when publishing; `Bhasini.Web.csproj` now includes
   `wwwroot/.well-known` explicitly. This was tested: the file reaches the published site.) Wait for the Pages
   deploy, check the URL returns just the token, then click verify.
6. **Review details:** the test cases import from the package. Reviewer credentials: none needed ("No sign-in required").
7. **Submit for review** and accept the policy attestations. Feedback arrives by email. Reply to that email to appeal.
8. After approval, select **Publish plugin**.

**Later changes:** the server is re-scanned daily, so tool updates deployed to the Worker go live after
automated checks. Listing or skill changes need a new zip and review. Bump `version` in
`build_manifest.py` each time.

---

## 5. Demo video script (about 75 seconds)

Record ChatGPT in a browser at 1080p, with the plugin connected through developer mode. Use a clean
chat, no other plugins, and zoom the page to 125% so the Indian scripts are readable. Show the tool
call each time (expand it if ChatGPT collapses it). No voice-over is needed; on-screen captions are enough.

| Time | On screen | Caption |
|---|---|---|
| 0:00–0:06 | bhasini.com/mcp/ page | "Bhasini: exact spelling for the 22 languages of India, inside ChatGPT." |
| 0:06–0:12 | ChatGPT settings, showing the Bhasini app connected (URL https://mcp.bhasini.com/mcp, no sign-in) | "No account needed." |
| 0:12–0:24 | Prompt 1: *Write the Tamil words vaNakkam and nanRi in Tamil script.* Tool call `transliterate` → வணக்கம், நன்றி | "Romanised words → native script." |
| 0:24–0:36 | Prompt 2: *Rewrite नमस्ते भारत in Kannada script…* `convert_script` → ನಮಸ್ತೇ ಭಾರತ | "Same words, another script." |
| 0:36–0:46 | Prompt 3: *Which keys do I press to type ழ…* `get_keymap` → zh | "Learn to type any letter." |
| 0:46–0:54 | Prompt 4: *Write the year 2026 in Devanagari and Bengali numerals.* `native_digits` → २०२६, ২০২৬ | "Native numerals." |
| 0:54–1:06 | Prompt 5: *Translate 'Where is the railway station?' into Tamil.* `translate` → ரயில் நிலையம் எங்கே? | "Translation to and from 22 Indian languages." |
| 1:06–1:15 | Negative 1: *Translate 'Bonjour, comment ça va ?' into English.* ChatGPT answers without calling Bhasini | "Only Indian languages go to Bhasini." |

Upload as **unlisted** (YouTube) or link-shared (Drive), and check that the link opens in a private window.

---

## 6. Risks to be ready for

- **First review (21 Oct 2026) was rejected** for (1) an incomplete privacy policy and (2) name/description quality. Fixes in 0.1.1:
  - `privacy.html` now lists, for the hosted server, each tool's inputs and outputs, the purposes, recipients, a retention table and user controls, matching what the Worker does (no tool text logged; IP used as a 60-second rate-limit key; Workers operational logs, retention ≤7 days, since `[observability]` is on in `wrangler.toml`). If you change logging or retention, update the policy first.
  - The listing no longer compares itself to other language models, makes "always right" claims or mentions "free" (OpenAI disallows comparisons, unverifiable claims and pricing in descriptions). The display name is now "Bhasini Indic Scripts", which says what it does and keeps it apart from the government's BHASHINI.
- **0.2.0 (22 Oct 2026) adds `translate`.** The 0.1.1 demo video shows no translation; record a new one from §5
  and update `DEMO_VIDEO_URL` before submitting 0.2.0 for review. The tool itself reaches ChatGPT on the daily
  re-scan, but the listing, skill and test cases still say "Bhasini does not translate" until 0.2.0 is approved.
- **Translation limits:** 2,000 characters a call, 5 calls a minute and 10,000 characters a day per IP (all
  free users share 300,000 a day). Reviewers sharing an OpenAI egress IP could hit the daily cap; the
  limits are in `workers/bhasini-mcp/wrangler.toml` and `src/quota.ts`.
- **A transliterate mix-up depends on the model.** If ChatGPT calls `transliterate` on English during review, improve the `transliterate` tool description in `src/Bhasini.Mcp/IndicTools.cs` (it already says "not translation"), then run `npm run fixtures` and redeploy the Worker. The server is re-scanned daily.
- **Rate limit:** 120 requests a minute per IP. Reviewers won't hit it, but heavy shared networks could. It's set in `workers/bhasini-mcp/wrangler.toml`.
