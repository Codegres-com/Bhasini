import type { IndicLanguage } from "./catalog.ts";
import { SOURCES } from "./mappers.ts";
import type { ScriptMapper } from "./types.ts";

// Port of Scripts/ScriptConverter.cs.

export const canConvertTo = (target: IndicLanguage): boolean => target.mapper !== undefined;

const isJoiner = (c: string) => c === "‌" || c === "‍" || c === "।" || c === "॥";
const owner = (c: string): ScriptMapper | undefined => SOURCES.find((m) => m.owns(c));

// Rewrites text in any Brahmic script (or Meetei Mayek) into the target language's script.
// Characters of other scripts are kept as they are.
export function convertScript(text: string, target: IndicLanguage): string {
  const mapper = target.mapper;
  if (!text || !mapper) return text;

  let result = "";
  let i = 0;
  while (i < text.length) {
    const source = owner(text[i]);
    const start = i;
    while (i < text.length && (source === undefined ? owner(text[i]) === undefined : source.owns(text[i]) || isJoiner(text[i]))) {
      i++;
    }

    const run = text.substring(start, i);
    if (source === undefined || source === mapper) result += run;
    else result += mapper.fromDevanagari(source.toDevanagari(run), false);
  }
  return result;
}

// Transliterates romanised words (e.g. pasted "namaste") with the language's phonetic scheme.
export function fromRoman(text: string, target: IndicLanguage): string {
  if (!text) return text;

  const phonetic = target.phonetic;
  let result = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) {
      const start = i;
      while (i < text.length && phonetic.isWordChar(text[i])) i++;
      result += phonetic.render(text.substring(start, i));
    } else {
      result += target.punctuation[c] ?? c;
      i++;
    }
  }
  return result;
}
