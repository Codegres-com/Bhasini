import { isUpper, type KeymapEntry, type KeymapGroup, type ScriptMapper, type Transliterator } from "./types.ts";

// Port of Input/BrahmicPhoneticEngine.cs: ITRANS / Baraha-style phonetic typing for every Brahmic
// script: Latin -> Devanagari space, then the language's script mapper.

export type TokenKind = "consonant" | "vowel" | "modifier" | "virama" | "separator" | "literal";

// Text is in Devanagari space. For vowels, text is the independent letter and sign the matra.
export interface PhoneticToken {
  kind: TokenKind;
  text: string;
  sign: string;
}

export interface PhoneticProfile {
  // Dravidian languages distinguish short e/o (e, o) from long (E/ee, O/oo).
  dravidianVowels?: boolean;
  // Word-final consonants without a vowel take a virama (Kannada, Tamil, Sanskrit…).
  finalVirama?: boolean;
  // Tamil: "n" is ந at a word start or before a dental, ன elsewhere.
  tamilNasal?: boolean;
  overrides?: Record<string, PhoneticToken>;
}

const VIRAMA = "्";
const NUKTA = "़";

export const C = (deva: string): PhoneticToken => ({ kind: "consonant", text: deva, sign: "" });
export const V = (letter: string, sign: string): PhoneticToken => ({ kind: "vowel", text: letter, sign });
const T = (kind: TokenKind, text: string): PhoneticToken => ({ kind, text, sign: "" });

type Item = [keys: string[], token: PhoneticToken];

// Keys listed together are aliases; the first is shown first in the keymap.
const BASE_VOWELS: Item[] = [
  [["a"], V("अ", "")],
  [["aa", "A"], V("आ", "ा")],
  [["i"], V("इ", "ि")],
  [["ii", "I"], V("ई", "ी")],
  [["u"], V("उ", "ु")],
  [["uu", "U"], V("ऊ", "ू")],
  [["R^i", "RRi"], V("ऋ", "ृ")],
  [["R^I", "RRI"], V("ॠ", "ॄ")],
  [["E"], V("ए", "े")],
  [["ai"], V("ऐ", "ै")],
  [["O"], V("ओ", "ो")],
  [["au", "ou"], V("औ", "ौ")],
  [["^e"], V("ऍ", "ॅ")],
  [["^o"], V("ऑ", "ॉ")],
];

const NORTH_VOWELS: Item[] = [
  [["e"], V("ए", "े")],
  [["ee"], V("ई", "ी")],
  [["o"], V("ओ", "ो")],
  [["oo"], V("ऊ", "ू")],
];

const DRAVIDIAN_VOWELS: Item[] = [
  [["e"], V("ऎ", "ॆ")],
  [["ee"], V("ए", "े")],
  [["o"], V("ऒ", "ॊ")],
  [["oo"], V("ओ", "ो")],
];

const BASE_CONSONANTS: Item[] = [
  [["k"], C("क")], [["kh", "K"], C("ख")], [["g"], C("ग")],
  [["gh", "G"], C("घ")], [["~N", "N^", "NG"], C("ङ")],
  [["ch", "c"], C("च")], [["chh", "Ch", "C"], C("छ")], [["j"], C("ज")],
  [["jh", "J"], C("झ")], [["~n", "JN"], C("ञ")],
  [["T"], C("ट")], [["Th"], C("ठ")], [["D"], C("ड")],
  [["Dh"], C("ढ")], [["N"], C("ण")],
  [["t"], C("त")], [["th"], C("थ")], [["d"], C("द")],
  [["dh"], C("ध")], [["n"], C("न")],
  [["p"], C("प")], [["ph", "P"], C("फ")], [["b"], C("ब")],
  [["bh", "B"], C("भ")], [["m"], C("म")],
  [["y"], C("य")], [["r"], C("र")], [["l"], C("ल")],
  [["v", "w"], C("व")], [["sh", "S"], C("श")], [["Sh", "shh"], C("ष")],
  [["s"], C("स")], [["h"], C("ह")], [["L"], C("ळ")],
  [["x", "ksh"], C("क्ष")], [["GY", "jn", "dny"], C("ज्ञ")],
  [["q"], C("क" + NUKTA)], [["z"], C("ज" + NUKTA)], [["f"], C("फ" + NUKTA)],
  [[".D"], C("ड" + NUKTA)], [[".Dh"], C("ढ" + NUKTA)],
  [["rx"], C("ऱ")], [["Lx"], C("ऴ")], [["nx"], C("ऩ")],
];

const BASE_MARKS: Item[] = [
  [["M", ".n"], T("modifier", "ं")],
  [["H"], T("modifier", "ः")],
  [[".N", "~"], T("modifier", "ँ")],
  [[".h"], T("virama", VIRAMA)],
  [["_"], T("separator", "")],
  [[".a"], T("literal", "ऽ")],
  [["OM"], T("literal", "ॐ")],
  [["|"], T("literal", "।")],
  [["||"], T("literal", "॥")],
];

interface Token {
  key: string;
  token: PhoneticToken;
}

export class BrahmicPhoneticEngine implements Transliterator {
  private readonly profile: PhoneticProfile;
  private readonly mapper: ScriptMapper;
  private readonly table = new Map<string, PhoneticToken>();
  private readonly maxTokenLength: number;
  private cachedKeymap?: KeymapGroup[];

  constructor(profile: PhoneticProfile, mapper: ScriptMapper) {
    this.profile = profile;
    this.mapper = mapper;
    for (const group of this.allGroups()) {
      for (const [keys, token] of group.items) {
        for (const key of keys) this.table.set(key, token);
      }
    }
    for (const [key, token] of Object.entries(profile.overrides ?? {})) this.table.set(key, token);
    this.maxTokenLength = Math.max(...[...this.table.keys()].map((k) => k.length));
  }

  private allGroups(): { title: string; items: Item[] }[] {
    // e/o keys go after u/uu so the keymap reads in alphabet order.
    const profileVowels = this.profile.dravidianVowels ? DRAVIDIAN_VOWELS : NORTH_VOWELS;
    return [
      { title: "Vowels", items: [...BASE_VOWELS.slice(0, 6), ...profileVowels, ...BASE_VOWELS.slice(6)] },
      { title: "Consonants", items: BASE_CONSONANTS },
      { title: "Signs", items: BASE_MARKS },
    ];
  }

  isWordChar(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "." || c === "~" || c === "^" || c === "_" || c === "|";
  }

  render(latinWord: string): string {
    return this.mapper.fromDevanagari(this.renderDevanagari(latinWord), true);
  }

  renderDevanagari(latinWord: string): string {
    const tokens = this.tokenize(latinWord);
    let out = "";
    let pending = false; // last output is a consonant still carrying its inherent vowel

    for (let i = 0; i < tokens.length; i++) {
      const { key, token } = tokens[i];
      switch (token.kind) {
        case "consonant":
          if (pending) out += VIRAMA;
          out += this.profile.tamilNasal && key === "n" ? tamilN(tokens, i) : token.text;
          pending = true;
          break;
        case "vowel":
          out += pending ? token.sign : token.text;
          pending = false;
          break;
        case "modifier":
          out += token.text;
          pending = false;
          break;
        case "virama":
          if (pending) out += VIRAMA;
          pending = false;
          break;
        case "separator":
          pending = false;
          break;
        default:
          if (pending && this.profile.finalVirama) out += VIRAMA;
          out += token.text;
          pending = false;
          break;
      }
    }

    if (pending && this.profile.finalVirama) out += VIRAMA;
    return out;
  }

  private tokenize(s: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < s.length) {
      let matched = false;
      for (let len = Math.min(this.maxTokenLength, s.length - i); len >= 1; len--) {
        const sub = s.substring(i, i + len);
        let token = this.table.get(sub);
        if (token) {
          tokens.push({ key: sub, token });
          i += len;
          matched = true;
          break;
        }

        // Tolerate a capitalised first letter ("Kh", "Ee") when no exact key exists.
        if (isUpper(sub[0])) {
          const lowered = sub[0].toLowerCase() + sub.substring(1);
          token = this.table.get(lowered);
          if (token) {
            tokens.push({ key: lowered, token });
            i += len;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        tokens.push({ key: s[i], token: T("literal", s[i]) });
        i++;
      }
    }
    return tokens;
  }

  get keymap(): KeymapGroup[] {
    return (this.cachedKeymap ??= this.buildKeymap());
  }

  private buildKeymap(): KeymapGroup[] {
    const groups: KeymapGroup[] = [];
    const shown = new Set<string>();

    for (const { title, items } of this.allGroups()) {
      const entries: KeymapEntry[] = [];
      for (const [keys] of items) {
        // Aliases a profile overrode now produce something else, so group keys by output.
        const byOutput = new Map<string, string[]>();
        for (const k of keys) {
          const sample = this.sample(k);
          const list = byOutput.get(sample);
          if (list) list.push(k);
          else byOutput.set(sample, [k]);
        }
        for (const [output, group] of byOutput) {
          if (!output) continue;
          const label = group.join(" ");
          const id = label + "\u0001" + output;
          if (!shown.has(id)) {
            shown.add(id);
            entries.push({ keys: label, output });
          }
        }
      }
      groups.push({ title, entries });
    }

    const listed = groups.flatMap((g) => g.entries);
    const extra = Object.keys(this.profile.overrides ?? {})
      .filter((key) => !listed.some((e) => e.keys.split(" ").includes(key)))
      .map((key) => ({ keys: key, output: this.sample(key) }));
    if (extra.length > 0) groups.splice(2, 0, { title: "Special", entries: extra });

    return groups;
  }

  // What a key produces on its own: consonants are shown with the inherent vowel.
  private sample(key: string): string {
    const token = this.table.get(key)!;
    switch (token.kind) {
      case "modifier":
        return this.mapper.fromDevanagari("◌" + token.text, false);
      case "virama":
        return this.mapper.fromDevanagari("◌" + VIRAMA, false);
      case "separator":
        return "(no join)";
      default:
        return this.mapper.fromDevanagari(token.text, false);
    }
  }
}

function tamilN(tokens: Token[], i: number): string {
  const wordStart = i === 0 || tokens[i - 1].token.kind === "literal" || tokens[i - 1].token.kind === "separator";
  if (wordStart) return "न";

  if (i + 1 < tokens.length && tokens[i + 1].token.kind === "consonant") {
    const next = tokens[i + 1].token.text;
    if (next === "त" || next === "थ" || next === "द" || next === "ध") return "न";
  }
  return "ऩ";
}
