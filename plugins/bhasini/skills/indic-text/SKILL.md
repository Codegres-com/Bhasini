---
name: indic-text
description: Use when writing, spelling or converting text in an Indian language script (Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, Urdu, Assamese, Santali, Manipuri, Sanskrit and the other scheduled languages of India), or when someone asks how to type one.
---

# Writing Indian-language text with Bhasini

Use the `bhasini` MCP tools instead of writing Indic letters from memory whenever exact spelling matters:
names, addresses, greetings, signage, certificates, or any script you are less sure of (Ol Chiki,
Meetei Mayek, Perso-Arabic Kashmiri or Sindhi, Gurmukhi tippi/addak, Malayalam chillus).

## Which tool

- **Romanised words to a script** ("write 'namaste' in Hindi"): `transliterate`. It writes sounds, not
  meanings, so pass the word as it sounds in the target language, not its English translation.
- **One Indian script to another** (Hindi text so a Kannada reader can read it): `convert_script`.
  The language stays the same; only the letters change. Perso-Arabic and Ol Chiki are not targets.
- **How to type a letter, or unsure of the romanisation**: `get_keymap`, then build the input from it.
  Capitals mark long vowels and retroflex consonants (`A I U E O`, `T D N L Sh`); `M` is anusvara.
- **Digits** in native numerals: `native_digits`.
- **Language codes**: `list_languages` (for example `hi`, `ta`, `kn`, `sat`, `mni`, `ks`, `sd`).

## Good habits

- Show the romanised input next to the result the first time, so the user can correct the spelling.
- For a translation request, translate into the language first, then use `transliterate` only if you
  wrote the translation in Latin letters.
- If a result looks wrong, check the keys with `get_keymap` and try again rather than editing letters by hand.
