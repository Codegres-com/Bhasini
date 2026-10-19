import { isUpper, type KeymapGroup, type Transliterator } from "./types.ts";

// Port of Input/SequenceEngine.cs and Input/SequenceMaps.cs: greedy longest-match transliteration
// for alphabetic scripts (Perso-Arabic, Ol Chiki).

// One key sequence's output, optionally different at the start or end of a word.
export interface SequenceEntry {
  medial: string;
  initial?: string;
  final?: string;
}

export type SequenceGroups = [title: string, keys: string[]][];

const E = (medial: string, initial?: string, final?: string): SequenceEntry => ({ medial, initial, final });

export class SequenceEngine implements Transliterator {
  private readonly map: Map<string, SequenceEntry>;
  private readonly maxLength: number;
  private readonly groups: SequenceGroups;
  private cachedKeymap?: KeymapGroup[];

  constructor(map: Map<string, SequenceEntry>, groups: SequenceGroups) {
    this.map = map;
    this.maxLength = Math.max(...[...map.keys()].map((k) => k.length));
    this.groups = groups;
  }

  isWordChar(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "'" || c === "~" || c === ":";
  }

  render(latinWord: string): string {
    const tokens: { key: string; entry?: SequenceEntry }[] = [];
    let i = 0;
    while (i < latinWord.length) {
      let matched = false;
      for (let len = Math.min(this.maxLength, latinWord.length - i); len >= 1; len--) {
        let sub = latinWord.substring(i, i + len);
        let entry = this.map.get(sub);
        if (!entry && isUpper(sub[0])) {
          sub = sub[0].toLowerCase() + sub.substring(1);
          entry = this.map.get(sub);
        }
        if (entry) {
          tokens.push({ key: sub, entry });
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        tokens.push({ key: latinWord[i] });
        i++;
      }
    }

    let out = "";
    for (let t = 0; t < tokens.length; t++) {
      const { key, entry } = tokens[t];
      if (!entry) out += key;
      else if (t === 0) out += entry.initial ?? entry.medial;
      else if (t === tokens.length - 1) out += entry.final ?? entry.medial;
      else out += entry.medial;
    }
    return out;
  }

  get keymap(): KeymapGroup[] {
    return (this.cachedKeymap ??= this.groups.map(([title, keys]) => ({
      title,
      entries: keys.filter((k) => this.map.has(k)).map((k) => {
        const e = this.map.get(k)!;
        const text = e.medial.length > 0 ? e.medial : (e.initial ?? e.final ?? "");
        return e.initial !== undefined && e.initial !== text
          ? { keys: k, output: text, note: "start " + e.initial }
          : { keys: k, output: text };
      }),
    })));
  }
}

const ARABIC_VOWEL_KEYS = ["a", "aa", "A", "i", "ii", "ee", "I", "u", "uu", "oo", "U", "e", "E", "ai", "o", "O", "au", "ou"];

// Urdu phonetic: short vowels are unwritten inside a word, aspirates take do-chashmi he (ھ).
export function urdu(): Map<string, SequenceEntry> {
  return new Map(Object.entries({
    "a": E("", "ا", "ا"), "aa": E("ا", "آ"), "A": E("ا", "آ"),
    "i": E("", "ا", "ی"), "ii": E("ی", "ای"), "ee": E("ی", "ای"), "I": E("ی", "ای"),
    "u": E("", "ا", "و"), "uu": E("و", "او"), "oo": E("و", "او"), "U": E("و", "او"),
    "e": E("ی", "ای", "ے"), "E": E("ی", "ای", "ے"), "ai": E("ی", "اے", "ے"),
    "o": E("و", "او"), "O": E("و", "او"), "au": E("و", "او"), "ou": E("و", "او"),

    "b": E("ب"), "bh": E("بھ"), "p": E("پ"), "ph": E("پھ"), "f": E("ف"),
    "t": E("ت"), "th": E("تھ"), "T": E("ٹ"), "Th": E("ٹھ"), "t'": E("ط"),
    "s": E("س"), "S": E("ص"), "sh": E("ش"), "s'": E("ث"),
    "j": E("ج"), "jh": E("جھ"), "c": E("چ"), "ch": E("چ"), "chh": E("چھ"),
    "h": E("ہ"), "H": E("ح"), "x": E("خ"), "kh": E("کھ"), "KH": E("خ"),
    "d": E("د"), "dh": E("دھ"), "D": E("ڈ"), "Dh": E("ڈھ"),
    "z": E("ز"), "Z": E("ض"), "zz": E("ذ"), "z'": E("ظ"), "zh": E("ژ"),
    "r": E("ر"), "R": E("ڑ"), "Rh": E("ڑھ"),
    "k": E("ک"), "q": E("ق"), "g": E("گ"), "gh": E("گھ"), "G": E("غ"),
    "l": E("ل"), "m": E("م"), "n": E("ن"), "N": E("ن", undefined, "ں"),
    "v": E("و"), "w": E("و"), "y": E("ی"), "Y": E("ے"),
    "'": E("ع"), "''": E("ء"),
  }));
}

const URDU_CONSONANT_KEYS = ["b", "bh", "p", "ph", "t", "th", "T", "Th", "t'", "s'", "j", "jh", "ch", "chh", "H", "x", "KH", "kh",
  "d", "dh", "D", "Dh", "zz", "r", "R", "Rh", "z", "zh", "s", "sh", "S", "Z", "z'", "'", "G", "f", "q", "k", "g", "gh",
  "l", "m", "n", "N", "v", "w", "h", "y", "Y", "''"];

export const URDU_GROUPS: SequenceGroups = [["Vowels", ARABIC_VOWEL_KEYS], ["Consonants", URDU_CONSONANT_KEYS]];

// Kashmiri (Perso-Arabic): Urdu letters plus ts/tsh and the Kashmiri vowel signs.
export function kashmiri(): Map<string, SequenceEntry> {
  const map = urdu();
  map.set("ts", E("ژ"));
  map.set("tsh", E("ژھ"));
  map.set("aa'", E("ٲ", "ٲ"));
  map.set("o'", E("ۄ", "اۄ"));
  map.set("u'", E("ٕ"));
  return map;
}

export const KASHMIRI_GROUPS: SequenceGroups = [
  ["Vowels", [...ARABIC_VOWEL_KEYS, "aa'", "o'", "u'"]],
  ["Consonants", [...URDU_CONSONANT_KEYS, "ts", "tsh"]],
];

// Sindhi (Perso-Arabic): its own implosives and retroflexes, Arabic yeh (ي) and heh (ه).
export function sindhi(): Map<string, SequenceEntry> {
  const sindhify = (s: string) => s.replaceAll("ی", "ي").replaceAll("ے", "ي").replaceAll("ہ", "ه");
  const map = new Map<string, SequenceEntry>();
  for (const [key, e] of urdu()) {
    map.set(key, E(sindhify(e.medial), e.initial === undefined ? undefined : sindhify(e.initial), e.final === undefined ? undefined : sindhify(e.final)));
  }
  const set = (k: string, v: string) => map.set(k, E(v));
  set("k", "ڪ"); set("kh", "ک"); set("gg", "ڳ"); set("ng", "ڱ");
  set("jj", "ڄ"); set("ny", "ڃ"); set("chh", "ڇ");
  set("T", "ٽ"); set("Th", "ٺ"); set("th", "ٿ");
  set("D", "ڊ"); set("Dh", "ڍ"); set("dd", "ڏ"); set("dh", "ڌ");
  set("R", "ڙ"); set("N", "ڻ"); set("ph", "ڦ");
  set("bb", "ٻ"); set("bh", "ڀ");
  return map;
}

export const SINDHI_GROUPS: SequenceGroups = [
  ["Vowels", ARABIC_VOWEL_KEYS],
  ["Consonants", [...URDU_CONSONANT_KEYS, "gg", "ng", "jj", "ny", "dd", "bb"]],
];

// Santali in Ol Chiki (alphabetic: every vowel is a letter).
export function olChiki(): Map<string, SequenceEntry> {
  return new Map(Object.entries({
    "a": E("ᱟ"), "aa": E("ᱟ"), "A": E("ᱟ"), "O": E("ᱚ"), "aw": E("ᱚ"),
    "i": E("ᱤ"), "ii": E("ᱤ"), "u": E("ᱩ"), "uu": E("ᱩ"), "e": E("ᱮ"), "o": E("ᱳ"),
    "k": E("ᱠ"), "kh": E("ᱠᱷ"), "g": E("ᱜ"), "gh": E("ᱜᱷ"), "ng": E("ᱝ"),
    "c": E("ᱪ"), "ch": E("ᱪ"), "chh": E("ᱪᱷ"), "j": E("ᱡ"), "jh": E("ᱡᱷ"), "ny": E("ᱧ"),
    "T": E("ᱴ"), "Th": E("ᱴᱷ"), "D": E("ᱰ"), "Dh": E("ᱰᱷ"), "N": E("ᱬ"),
    "t": E("ᱛ"), "th": E("ᱛᱷ"), "d": E("ᱫ"), "dh": E("ᱫᱷ"), "n": E("ᱱ"),
    "p": E("ᱯ"), "ph": E("ᱯᱷ"), "b": E("ᱵ"), "bh": E("ᱵᱷ"), "m": E("ᱢ"),
    "y": E("ᱭ"), "r": E("ᱨ"), "R": E("ᱲ"), "Rh": E("ᱲᱷ"), "l": E("ᱞ"),
    "w": E("ᱣ"), "v": E("ᱶ"), "s": E("ᱥ"), "h": E("ᱦ"),
    "~": E("ᱸ"), "'": E("ᱹ"), ":": E("ᱻ"), "''": E("ᱽ"),
  }));
}

export const OL_CHIKI_GROUPS: SequenceGroups = [
  ["Vowels", ["a", "O", "i", "u", "e", "o"]],
  ["Consonants", ["k", "kh", "g", "gh", "ng", "c", "chh", "j", "jh", "ny", "T", "Th", "D", "Dh", "N",
    "t", "th", "d", "dh", "n", "p", "ph", "b", "bh", "m", "y", "r", "R", "Rh", "l", "w", "v", "s", "h"]],
  ["Signs", ["~", "'", ":", "''"]],
];
