---
name: get-started
description: Use when someone wants to write, spell or convert text in an Indian language script (Hindi, Tamil, Bengali, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, Urdu, Santali, Manipuri, Sanskrit and the other scheduled languages of India), or asks how to type one.
---

# Writing Indian-language text with Bhasini

Use the Bhasini tools instead of writing Indic letters from memory whenever exact spelling matters:
names, greetings, addresses, signage, certificates, or scripts you are less sure of (Ol Chiki,
Meetei Mayek, Perso-Arabic Kashmiri or Sindhi).

- **Romanised words to a script** ("write vaNakkam in Tamil"): `transliterate`. It writes sounds, not
  meanings. Pass the word as it sounds in the target language, never an English word to be translated.
- **One Indian script to another** (Hindi text for a Kannada reader): `convert_script`. Only the letters
  change; the language stays the same.
- **Which keys type a letter**, or unsure how to romanise: `get_keymap`. Capitals mark long vowels and
  retroflex consonants (`A I U E O`, `T D N L Sh`); `M` is anusvara.
- **Native numerals**: `native_digits`.
- **Language codes and scripts**: `list_languages`.

For a translation request, translate yourself first. Bhasini does not translate.
