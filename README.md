# Bhasini (भाषिणी)

A multilingual Indic typing editor for all **22 scheduled languages of India**, built with
Blazor WebAssembly. Everything runs in the browser; no server round-trips while you type.

It grew out of the Kannada Nudi web editor (`KannadaNudiEditor/KannadaNudiWeb`) and keeps its
shape: a Quill rich-text editor whose keystrokes are transliterated by a C# engine.

## Languages

| Language | Script | Since |
|---|---|---|
| Assamese | Bengali-Assamese (ৰ, ৱ) | 1950 |
| Bengali | Bengali | 1950 |
| Bodo | Devanagari | 2003 |
| Dogri | Devanagari | 2003 |
| Gujarati | Gujarati | 1950 |
| Hindi | Devanagari | 1950 |
| Kannada | Kannada | 1950 |
| Kashmiri | Perso-Arabic (RTL), also Devanagari | 1950 |
| Konkani | Devanagari | 1992 |
| Maithili | Devanagari | 2003 |
| Malayalam | Malayalam (chillus, Mozhi-style keys) | 1950 |
| Manipuri | Meetei Mayek (lonsum letters), also Bengali | 1992 |
| Marathi | Devanagari (ळ) | 1950 |
| Nepali | Devanagari | 1992 |
| Odia | Odia | 1950 |
| Punjabi | Gurmukhi (tippi, bindi, addak) | 1950 |
| Sanskrit | Devanagari | 1950 |
| Santali | Ol Chiki | 2003 |
| Sindhi | Perso-Arabic (RTL), also Devanagari | 1967 |
| Tamil | Tamil (ந/ன by context, ற, ழ) | 1950 |
| Telugu | Telugu | 1950 |
| Urdu | Perso-Arabic, Nastaliq (RTL) | 1950 |

Plus English (no transliteration).

## Features

- **Phonetic typing**: type how it sounds (`namaste` → नमस्ते, `vaNakkam` → வணக்கம், `aadaab` → آداب).
  ITRANS/Baraha-style keys: capitals for retroflex/long sounds (`T D N L Sh A I U E O`), `M` anusvara,
  `H` visarga, `.h` explicit virama, `_` to stop letters joining, `|` / `||` danda.
- **InScript**: the government-standard layout for every Brahmic script.
- **F9** switches between the selected language and English.
- **Key map panel** for the current language and method. Tap a letter to insert it, which also helps on phones.
- **Native digits** toggle (१२३, ௧௨௩, ۱۲۳, …).
- **Convert**: rewrite text from one Indian script to another, or turn romanised text into script.
- **Dictation** through the browser's speech recognition (Chrome and Edge, where the locale is supported).
- Open `.txt` / `.docx`, save as `.docx`, `.txt` or `.html`. Settings are remembered per browser.

## How it works

`src/Bhasini.Core` has no web dependencies:

- `Input/BrahmicPhoneticEngine` turns Latin keys into Devanagari, with a per-language
  `PhoneticProfile` (Dravidian short e/o, word-final virama, Tamil nasals, local key conventions).
- `Scripts/OffsetScriptMapper` maps Devanagari into each ISCII-derived Unicode block by offset.
  Letters a script lacks fall back to the nearest letter. Script-specific spelling rules
  (Malayalam chillus, Gurmukhi tippi/addak, Bengali য়) run as post-processing.
- `Scripts/MeeteiMayekMapper` handles Meetei Mayek. `Input/SequenceEngine` handles the alphabetic
  scripts (Perso-Arabic with word-initial/final forms, and Ol Chiki).
- `Input/TypingSession` keeps the Latin keys of the current word and re-renders the whole word
  on every key, returning a minimal `{ delete, insert }` edit for the editor.

`src/Bhasini.Web` is the Blazor WebAssembly app. `wwwroot/js/editor.js` intercepts keys in Quill
and calls the session synchronously.

## Run

Requires the .NET 8 SDK.

```bash
dotnet run --project src/Bhasini.Web
```

```bash
dotnet test
```

Docker (nginx serving the published static files on port 5000):

```bash
docker build -t bhasini .
```

Script fonts come from Google Fonts (Noto). When offline, the editor falls back to system fonts
such as Nirmala UI on Windows.
