"""Writes docs/chatgpt-plugin/plugin.json for the ChatGPT plugin submission and checks OpenAI's limits.

Run from the repo root:
  python tools/chatgpt-plugin/build_manifest.py           check limits, write plugin.json
  python tools/chatgpt-plugin/build_manifest.py --zip     also build artifacts/bhasini-chatgpt-plugin.zip (needs DEMO_VIDEO_URL)
  python tools/chatgpt-plugin/build_manifest.py --draft   build artifacts/bhasini-chatgpt-plugin-draft.zip without the video,
                                                          to upload a draft and run the portal's checks early
Upload the zip at platform.openai.com/plugins.
Limits: https://developers.openai.com/apps-sdk/deploy/submission
"""
import json
import os
import sys

DEMO_VIDEO_URL = "https://youtu.be/uA634C1x7o8"  # an unlisted YouTube or Drive link reviewers can open

LONG_DESCRIPTION = """Bhasini Indic Scripts writes and translates text in the 22 scheduled languages of India: Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Kashmiri, Konkani, Maithili, Malayalam, Manipuri, Marathi, Nepali, Odia, Punjabi, Sanskrit, Santali, Sindhi, Tamil, Telugu and Urdu.

Spelling uses a rule-based transliteration engine, so the same input always gives the same spelling. It covers less widely supported scripts too, such as Ol Chiki (Santali), Meetei Mayek (Manipuri) and Perso-Arabic Kashmiri and Sindhi.

What you can ask:
- Write words in a native script: "Write vaNakkam and nanRi in Tamil script" gives வணக்கம், நன்றி.
- Convert text between Indian scripts: Hindi नमस्ते भारत becomes Kannada ನಮಸ್ತೇ ಭಾರತ, so a reader of one script can read text written in another.
- Translate between English and any of the 22 languages, or between two of them: "Where is the railway station?" becomes Tamil ரயில் நிலையம் எங்கே?
- Learn to type: find the keys for any letter on a phonetic keyboard, such as zh for ழ in Tamil.
- Write numbers in native numerals: 2026 becomes २०२६ in Hindi or ২০২৬ in Bengali.
- Look up the supported languages, scripts and language codes.

Transliteration writes the sounds of words in another script; translation carries their meaning into another language. Translation runs AI4Bharat IndicTrans2 and Google Gemma on Cloudflare Workers AI, for up to 2,000 characters a request and 10,000 characters a day.

No account or sign-in is needed. Bhasini receives only the text passed to its tools, never your conversation. That text is processed in memory and is not stored or logged. See the privacy policy for details.

Made by Codegres. The engine is open source under the MIT license at github.com/Codegres-com/Bhasini."""

POSITIVE = [
    {
        "description": "Romanised Tamil words written in Tamil script",
        "prompt": "Write the Tamil words vaNakkam and nanRi in Tamil script.",
        "tools_triggered": "transliterate",
        "expected_behavior": "Calls transliterate with language ta and replies with வணக்கம் and நன்றி.",
    },
    {
        "description": "Hindi text rewritten in Kannada script",
        "prompt": "Rewrite नमस्ते भारत in Kannada script so a Kannada reader can read it aloud.",
        "tools_triggered": "convert_script",
        "expected_behavior": "Calls convert_script with targetLanguage kn and replies with ನಮಸ್ತೇ ಭಾರತ, noting the words are still Hindi.",
    },
    {
        "description": "Keyboard keys for a Tamil letter",
        "prompt": "Which keys do I press to type ழ on a Tamil phonetic keyboard?",
        "tools_triggered": "get_keymap",
        "expected_behavior": "Calls get_keymap with language ta and answers that zh (or Lx) types ழ.",
    },
    {
        "description": "A year written in native numerals",
        "prompt": "Write the year 2026 in Devanagari numerals and in Bengali numerals.",
        "tools_triggered": "native_digits",
        "expected_behavior": "Calls native_digits for hi and bn and replies with २०२६ and ২০২৬.",
    },
    {
        "description": "English sentence translated into Tamil",
        "prompt": "Translate 'Where is the railway station?' into Tamil.",
        "tools_triggered": "translate",
        "expected_behavior": "Calls translate with targetLanguage ta and replies with ரயில் நிலையம் எங்கே?",
    },
]

NEGATIVE = [
    {
        "description": "Translation between two languages that are not Indian. Bhasini only translates to and from "
                       "the 22 scheduled languages of India, so no Bhasini tool should be called; ChatGPT translates itself.",
        "prompt": "Translate 'Bonjour, comment ça va ?' into English.",
    },
    {
        "description": "Unrelated coding request. No Bhasini tool should be called.",
        "prompt": "Write a Python function that reverses a string.",
    },
    {
        "description": "Unrelated question that mentions an Indian city. Bhasini has no weather or web data, "
                       "so no tool should be called.",
        "prompt": "What's the weather in Chennai today?",
    },
]

manifest = {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    "name": "bhasini",
    "version": "0.2.0",
    "description": "Transliteration, script conversion and translation for the 22 scheduled languages of India.",
    "author": {"name": "Codegres", "email": "naveen@codegres.com", "url": "https://codegres.com"},
    "homepage": "https://bhasini.com/mcp/",
    "repository": "https://github.com/Codegres-com/Bhasini",
    "license": "MIT",
    "keywords": ["indic", "india", "hindi", "tamil", "transliteration", "translation", "languages"],
    "extensions": {
        "com.openai": {
            "interface": {
                "displayName": "Bhasini Indic Scripts",
                "shortDescription": "Spell words in Indian scripts",
                "longDescription": LONG_DESCRIPTION,
                "developerName": "Codegres",
                "category": "Productivity",
                "capabilities": [
                    "Transliterate romanised words into 22 Indian language scripts",
                    "Convert text between Indian scripts, e.g. Devanagari to Kannada",
                    "Translate text between English and 22 Indian languages, or between two of them",
                    "Show the phonetic keyboard keys for any letter",
                    "Write digits in native numerals",
                ],
                "websiteURL": "https://bhasini.com/mcp/",
                "supportURL": "https://bhasini.com/mcp/",
                "privacyPolicyURL": "https://bhasini.com/privacy.html",
                "termsOfServiceURL": "https://bhasini.com/terms.html",
                "defaultPrompt": [
                    "Write vaNakkam and nanRi in Tamil script",
                    "Translate 'Where is the railway station?' into Tamil",
                    "Write the Santali word johar in Ol Chiki",
                ],
                "brandColor": "#F07B2B",
                "logo": "./assets/logo.png",
                "composerIcon": "./assets/logo.png",
            },
            "onboardingSkill": "./skills/get-started/SKILL.md",
            "review": {
                "test_cases": {"positive": POSITIVE, "negative": NEGATIVE},
                "demo_recording_url": DEMO_VIDEO_URL,
                "commerce": False,
            },
            "publication": {
                "release_notes": "New translate tool: translate text between English and the 22 scheduled "
                                 "languages of India, or between two of them (AI4Bharat IndicTrans2 and Google "
                                 "Gemma on Cloudflare Workers AI). Up to 2,000 characters a request and 10,000 a day.",
                "countries": [],
            },
        }
    },
}


def check(manifest, root):
    ui = manifest["extensions"]["com.openai"]["interface"]
    openai = manifest["extensions"]["com.openai"]
    problems = []

    def limit(field, value, n):
        if len(value) > n:
            problems.append(f"{field} is {len(value)} characters (max {n})")

    limit("displayName", ui["displayName"], 30)
    limit("shortDescription", ui["shortDescription"], 30)
    limit("longDescription", ui["longDescription"], 4000)
    limit("developerName", ui["developerName"], 80)
    if len(ui["capabilities"]) > 20:
        problems.append("more than 20 capabilities")
    for c in ui["capabilities"]:
        limit("capability", c, 120)
    if len(ui["defaultPrompt"]) > 3:
        problems.append("more than 3 defaultPrompt entries")
    for p in ui["defaultPrompt"]:
        limit("defaultPrompt", p, 128)
    for f in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
        if not ui[f].startswith("https://"):
            problems.append(f"{f} must be https")
        limit(f, ui[f], 1024)
    cases = openai["review"]["test_cases"]
    if len(cases["positive"]) != 5:
        problems.append("need exactly 5 positive test cases")
    if len(cases["negative"]) != 3:
        problems.append("need exactly 3 negative test cases")
    for c in cases["positive"]:
        for k in ("description", "prompt", "tools_triggered", "expected_behavior"):
            if not c.get(k):
                problems.append(f"positive case missing {k}")
            elif not isinstance(c[k], str):
                problems.append(f"positive case {k} must be a string (the portal rejects lists)")
    for c in cases["negative"]:
        for k in ("description", "prompt"):
            if not c.get(k):
                problems.append(f"negative case missing {k}")
    for rel in (ui["logo"], ui["composerIcon"], openai["onboardingSkill"], "./mcp.json"):
        if not os.path.isfile(os.path.join(root, rel)):
            problems.append(f"missing file {rel}")

    # The portal only discovers mcp.json with the Agent Plugins $schema, and plugin-level test cases
    # need exactly one server; otherwise it reports "require exactly one MCP server".
    mcp_path = os.path.join(root, "mcp.json")
    if os.path.isfile(mcp_path):
        with open(mcp_path, encoding="utf-8") as f:
            mcp = json.load(f)
        if mcp.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json":
            problems.append("mcp.json needs \"$schema\": \"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json\"")
        servers = mcp.get("mcpServers", {})
        if len(servers) != 1:
            problems.append(f"mcp.json must declare exactly one server for plugin-level test cases (found {len(servers)})")
        for name, server in servers.items():
            if server.get("type") != "streamable-http" or not str(server.get("url", "")).startswith("https://"):
                problems.append(f"mcp.json server {name} must be type streamable-http with an https url")
            if server.get("headers"):
                problems.append(f"mcp.json server {name} must not set headers for public submission")
    return problems


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "chatgpt-plugin"))
    problems = check(manifest, root)
    with open(os.path.join(root, "plugin.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    ui = manifest["extensions"]["com.openai"]["interface"]
    print(f"displayName {len(ui['displayName'])}/30, shortDescription {len(ui['shortDescription'])}/30, "
          f"longDescription {len(ui['longDescription'])}/4000")
    if DEMO_VIDEO_URL.startswith("REPLACE"):
        print("NOTE: set DEMO_VIDEO_URL before uploading (required for review).")
    if problems:
        print("PROBLEMS:\n  " + "\n  ".join(problems))
        sys.exit(1)
    print("All OpenAI limits OK. Wrote docs/chatgpt-plugin/plugin.json")

    # --zip: the upload package, with forward-slash paths and the files at the zip root.
    # (Windows PowerShell 5.1's Compress-Archive writes backslash paths, which validators can reject.)
    # --draft: the same package without demo_recording_url, for uploading a draft and running the
    # portal's checks before the demo video exists. It can't be submitted for review as is.
    draft = "--draft" in sys.argv
    if "--zip" in sys.argv or draft:
        packaged = manifest
        if DEMO_VIDEO_URL.startswith("REPLACE"):
            if not draft:
                print("Not zipping: set DEMO_VIDEO_URL first, or use --draft to build a draft package without it.")
                sys.exit(1)
            packaged = json.loads(json.dumps(manifest))
            del packaged["extensions"]["com.openai"]["review"]["demo_recording_url"]
        import zipfile
        out_dir = os.path.normpath(os.path.join(root, "..", "..", "artifacts"))
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, "bhasini-chatgpt-plugin-draft.zip" if draft else "bhasini-chatgpt-plugin.zip")
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for folder, _, files in os.walk(root):
                for name in sorted(files):
                    full = os.path.join(folder, name)
                    rel = os.path.relpath(full, root).replace(os.sep, "/")
                    if rel == "plugin.json":
                        z.writestr(rel, json.dumps(packaged, ensure_ascii=False, indent=2) + "\n")
                    else:
                        z.write(full, rel)
        print(f"Wrote {out}")
        if draft:
            print("DRAFT: upload it to test the portal checks. Add the demo video URL and rebuild with --zip before submitting for review.")
