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
| `displayName` | Bhasini | 7 / 30 |
| `shortDescription` | Write in 22 Indian scripts | 26 / 30 |
| `developerName` | Codegres | 8 / 80 |
| `category` | Productivity | dashboard category |
| `longDescription` | see below | 1,480 / 4,000 |
| `websiteURL` / `supportURL` | https://bhasini.com/mcp/ | |
| `privacyPolicyURL` | https://bhasini.com/privacy.html | |
| `termsOfServiceURL` | https://bhasini.com/terms.html | |
| `defaultPrompt` | "Write vaNakkam and nanRi in Tamil script" · "Rewrite नमस्ते भारत in Kannada script" · "Write the Santali word johar in Ol Chiki" | 3 × ≤128 |
| `capabilities` | 4 short lines (transliterate, convert scripts, keyboard keys, native digits) | ≤20 × ≤120 |
| `logo`, `composerIcon` | `assets/logo.png` (512 × 512, square) | ≥48 px, ≤5 MiB |
| `brandColor` | #F07B2B (Bhasini saffron) | |
| Commerce | No | |
| Countries | All (`[]`) | |

**Long description**

> Bhasini gives ChatGPT exact, rule-based spelling for all 22 scheduled languages of India: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu and Urdu.
>
> Language models often misspell Indian scripts, especially less common ones such as Ol Chiki (Santali), Meetei Mayek (Manipuri) and Perso-Arabic Kashmiri and Sindhi. Bhasini uses the same deterministic engine as the free bhasini.com editor, so the letters are always right.
>
> What you can ask:
> - Write words in a native script: "Write vaNakkam and nanRi in Tamil script" gives வணக்கம், நன்றி.
> - Convert text between Indian scripts: Hindi नमस्ते भारत becomes Kannada ನಮಸ್ತೇ ಭಾರತ, so a reader of one script can read text written in another.
> - Learn to type: find the keys for any letter on a phonetic keyboard, such as zh for ழ in Tamil.
> - Write numbers in native numerals: 2026 becomes २०२६ in Hindi or ২০২৬ in Bengali.
> - Look up the supported languages, scripts and codes.
>
> Bhasini transliterates (it writes sounds in another script); it does not translate meaning. ChatGPT translates, and Bhasini makes sure the result is spelled correctly.
>
> No account or sign-in is needed. Bhasini does not store or log the text you send, and it never sees your conversation, only the words passed to its tools.
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
| 5 | Which language code and script does Bhasini use for Santali? | `list_languages` | `sat`, Ol Chiki (ᱥᱟᱱᱛᱟᱲᱤ) |

### Negative (the plugin should not act, or must not be misused)

| # | Prompt | Why / expected |
|---|---|---|
| 1 | Translate 'How are you?' into Tamil. | Bhasini doesn't translate. ChatGPT should translate itself, and must not feed the English words to `transliterate`, which would produce sound-alike nonsense. It may use `transliterate` only on a romanised Tamil translation. |
| 2 | Write a Python function that reverses a string. | Unrelated; no Bhasini tool. |
| 3 | What's the weather in Chennai today? | Mentions an Indian city but needs weather data Bhasini doesn't have; no tool. |

---

## 4. Upload steps

1. Set `DEMO_VIDEO_URL` in `tools/chatgpt-plugin/build_manifest.py`, then build the package from the repo root:
   ```bash
   python tools/chatgpt-plugin/build_manifest.py --zip
   ```
   This checks every limit and writes `artifacts/bhasini-chatgpt-plugin.zip`, with the files at the zip root and forward-slash paths. Don't use PowerShell 5.1's `Compress-Archive`: it writes backslash paths.
2. Go to **https://platform.openai.com/plugins → Upload new or existing plugin**, choose the verified Codegres identity, and upload the zip.
3. Fix any **Metadata & Skills** findings in `build_manifest.py`, re-run step 1 and re-upload.
4. **Connect the MCP server.** Authentication: **None**. Wait for the automated tool scan. All five tools are read-only, annotated, and touch no user data.
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
| 0:54–1:04 | Prompt 5: *Which code and script for Santali?* `list_languages` → sat, Ol Chiki | "Rare scripts too: Ol Chiki, Meetei Mayek." |
| 1:04–1:15 | Negative 1: *Translate 'How are you?' into Tamil.* ChatGPT translates without misusing Bhasini | "Bhasini spells; ChatGPT translates." |

Upload as **unlisted** (YouTube) or link-shared (Drive), and check that the link opens in a private window.

---

## 6. Risks to be ready for

- **Name:** "Bhasini" is close to the government's BHASHINI. If a reviewer raises it, explain that it's a separate open-source project by Codegres, or change `displayName` to "Bhasini Indic".
- **Negative case 1 depends on the model.** If ChatGPT calls `transliterate` on English during review, improve the `transliterate` tool description in `src/Bhasini.Mcp/IndicTools.cs` (it already says "not translation"), then run `npm run fixtures` and redeploy the Worker. The server is re-scanned daily.
- **Rate limit:** 120 requests a minute per IP. Reviewers won't hit it, but heavy shared networks could. It's set in `workers/bhasini-mcp/wrangler.toml`.
