import { MeeteiMayekMapper } from "./meetei.ts";
import { OffsetScriptMapper } from "./offset.ts";
import type { ScriptMapper } from "./types.ts";

// Port of Scripts/ScriptMappers.cs.

const bengaliReverse = (): Record<string, string> => ({ "ৰ": "र", "ৱ": "व", "ৎ": "त्" });

// য after a vowel is pronounced and written য় (antahstha ya).
const BENGALI_YA = /(?<=[অ-ঔা-ৌ])য(?!়)/g;
const bengaliYaShruti = (s: string): string => s.replace(BENGALI_YA, "য়");

// Doubled consonants take addak, a nasal before a stop becomes bindi, and bindi becomes tippi
// after the inherent vowel and the short vowels.
const GURMUKHI_ADDAK = /([ਕ-ਹ])੍\1/g;
const GURMUKHI_NASAL = /[ਙਞਣਨਮ]੍(?=[ਕ-ਘਚ-ਝਟ-ਢਤ-ਧਪ-ਭਸ਼ਸ])/g;
const GURMUKHI_TIPPI = /(?<=[ਅਇਉਕ-ਹ਼ਿੁੂ])ਂ/g;

function gurmukhiSpelling(s: string): string {
  s = s.replace(GURMUKHI_ADDAK, "ੱ$1");
  s = s.replace(GURMUKHI_NASAL, "ਂ");
  return s.replace(GURMUKHI_TIPPI, "ੰ");
}

// Word-final n, N, r, l, L become chillus and final m becomes anusvara, as in Mozhi typing.
const MALAYALAM_CHILLU = /(?<!്)([ണനരലള])്(?=$|[^ഀ-ൿ])/g;
const MALAYALAM_FINAL_M = /(?<!്)മ്(?=$|[^ഀ-ൿ])/g;
const CHILLUS: Record<string, string> = { "ണ": "ൺ", "ന": "ൻ", "ര": "ർ", "ല": "ൽ", "ള": "ൾ" };

function malayalamSpelling(s: string): string {
  s = s.replace(MALAYALAM_CHILLU, (_m, letter: string) => CHILLUS[letter]);
  return s.replace(MALAYALAM_FINAL_M, "ം");
}

export const Devanagari = new OffsetScriptMapper(0x0900);

export const Bengali = new OffsetScriptMapper(0x0980, {
  reverseExtras: bengaliReverse(),
  phoneticPost: bengaliYaShruti,
});

// Assamese uses the Bengali block with its own ra (ৰ) and wa (ৱ).
export const Assamese = new OffsetScriptMapper(0x0980, {
  overrides: { "र": "ৰ", "व": "ৱ" },
  reverseExtras: bengaliReverse(),
  phoneticPost: bengaliYaShruti,
});

export const Gurmukhi = new OffsetScriptMapper(0x0A00, {
  reverseExtras: { "ੰ": "ं", "ੱ": "" },
  phoneticPost: gurmukhiSpelling,
});

export const Gujarati = new OffsetScriptMapper(0x0A80);

export const Odia = new OffsetScriptMapper(0x0B00, {
  overrides: { "य": "ୟ", "व": "ୱ" },
  reverseExtras: { "ୟ": "य", "ୱ": "व" },
});

export const Tamil = new OffsetScriptMapper(0x0B80, {
  overrides: { "ं": "ம்" },
  prePass: (s) => s.replaceAll("फ़", "ःप"),
});

export const Telugu = new OffsetScriptMapper(0x0C00, { unsupported: [0x0C3C] });

export const Kannada = new OffsetScriptMapper(0x0C80, {
  overrides: { "ऴ": "ೞ" },
  reverseExtras: { "ೞ": "ऴ" },
});

export const Malayalam = new OffsetScriptMapper(0x0D00, {
  unsupported: [0x0D3C],
  reverseExtras: { "ൺ": "ण्", "ൻ": "न्", "ർ": "र्", "ൽ": "ल्", "ൾ": "ळ्", "ൿ": "क्" },
  phoneticPost: malayalamSpelling,
});

export const MeeteiMayek = new MeeteiMayekMapper();

// Mappers that text can be converted from (one per Unicode block).
export const SOURCES: ScriptMapper[] = [
  Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, MeeteiMayek,
];
