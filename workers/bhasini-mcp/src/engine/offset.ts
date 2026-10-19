import type { ScriptMapper } from "./types.ts";
import unassigned from "../generated/unassigned.json" with { type: "json" };

// Port of Scripts/OffsetScriptMapper.cs: the nine ISCII-derived Unicode blocks share one layout,
// so a letter's offset from the block start is the same in every script; letters a script lacks
// fall back to the nearest one.

export const DEVANAGARI_BASE = 0x0900;
const NUKTA = "़";

// Replacement (in Devanagari space) for a letter that the target script does not have.
const FALLBACK: Record<string, string> = {
  "ँ": "ं",
  "ऍ": "ए", "ॅ": "े",
  "ऑ": "ओ", "ॉ": "ो",
  "ऎ": "ए", "ॆ": "े",
  "ऒ": "ओ", "ॊ": "ो",
  "ऋ": "रि", "ृ": "्रि",
  "ॠ": "री", "ॄ": "्री",
  "ऌ": "लि", "ॢ": "्लि",
  "ॡ": "ली", "ॣ": "्ली",
  "ख": "क", "ग": "क", "घ": "ग", "ङ": "न",
  "छ": "च", "झ": "ज", "ञ": "न",
  "ठ": "ट", "ड": "ट", "ढ": "ड",
  "थ": "त", "द": "त", "ध": "द",
  "फ": "प", "ब": "प", "भ": "ब",
  "ऩ": "न", "ऱ": "र", "ऴ": "ळ", "ळ": "ल",
  "व": "ब", "ष": "श", "श": "स",
  [NUKTA]: "", "ऽ": "", "ः": "",
  "ॐ": "ओम्",
};

// Code points whose meaning is shared across the nine blocks.
function isMappable(c: number): boolean {
  return (c >= 0x0901 && c <= 0x0903) ||
    (c >= 0x0905 && c <= 0x0939) ||
    (c >= 0x093C && c <= 0x094D) ||
    c === 0x0950 ||
    (c >= 0x0960 && c <= 0x0963) ||
    (c >= 0x0966 && c <= 0x096F);
}

const UNASSIGNED = new Map<number, Set<number>>(
  Object.entries(unassigned as Record<string, number[]>).map(([base, list]) => [parseInt(base, 16), new Set(list)]),
);

export interface OffsetMapperOptions {
  overrides?: Record<string, string>;
  unsupported?: number[];
  reverseExtras?: Record<string, string>;
  prePass?: (s: string) => string;
  phoneticPost?: (s: string) => string;
}

export class OffsetScriptMapper implements ScriptMapper {
  readonly blockBase: number;
  private readonly overrides: Record<string, string>;
  private readonly unsupported: Set<number>;
  private readonly reverseExtras: Record<string, string>;
  private readonly prePass?: (s: string) => string;
  private readonly phoneticPost?: (s: string) => string;
  private readonly unassigned: Set<number>;

  constructor(blockBase: number, options: OffsetMapperOptions = {}) {
    this.blockBase = blockBase;
    this.overrides = options.overrides ?? {};
    this.unsupported = new Set(options.unsupported ?? []);
    this.reverseExtras = options.reverseExtras ?? {};
    this.prePass = options.prePass;
    this.phoneticPost = options.phoneticPost;
    this.unassigned = UNASSIGNED.get(blockBase) ?? new Set();
  }

  owns(c: string): boolean {
    const code = c.charCodeAt(0);
    return code >= this.blockBase && code < this.blockBase + 0x80;
  }

  nativeDigit(digit: number): string {
    return String.fromCharCode(this.blockBase + 0x66 + digit);
  }

  private isAvailable(target: number): boolean {
    return !this.unsupported.has(target) && !this.unassigned.has(target);
  }

  fromDevanagari(deva: string, phonetic: boolean): string {
    if (!deva) return "";
    let input = decompose(deva);
    if (this.prePass) input = this.prePass(input);

    const out: string[] = [];
    for (let i = 0; i < input.length; i++) this.appendChar(out, input[i], 0);

    const result = out.join("");
    return phonetic && this.phoneticPost ? this.phoneticPost(result) : result;
  }

  private appendChar(out: string[], c: string, depth: number): void {
    const replaced = this.overrides[c];
    if (replaced !== undefined) {
      out.push(replaced);
      return;
    }

    const code = c.charCodeAt(0);
    if (!isMappable(code) || this.blockBase === DEVANAGARI_BASE) {
      out.push(c);
      return;
    }

    const target = this.blockBase + (code - DEVANAGARI_BASE);
    if (this.isAvailable(target)) {
      out.push(String.fromCharCode(target));
      return;
    }

    const fallback = FALLBACK[c];
    if (depth < 4 && fallback !== undefined) {
      for (let i = 0; i < fallback.length; i++) this.appendChar(out, fallback[i], depth + 1);
    }
  }

  toDevanagari(text: string): string {
    if (!text) return "";
    const out: string[] = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const extra = this.reverseExtras[c];
      if (extra !== undefined) {
        out.push(extra);
        continue;
      }
      if (this.owns(c)) {
        const deva = DEVANAGARI_BASE + (c.charCodeAt(0) - this.blockBase);
        if (isMappable(deva) || (deva >= 0x0958 && deva <= 0x095F)) {
          out.push(String.fromCharCode(deva));
          continue;
        }
      }
      out.push(c);
    }
    return out.join("");
  }
}

// Precomposed nukta letters (U+0958..U+095F) to base + nukta, so each script can decide whether
// it has a nukta at all.
const DECOMPOSED: Record<string, string> = {
  "क़": "क" + NUKTA, "ख़": "ख" + NUKTA, "ग़": "ग" + NUKTA, "ज़": "ज" + NUKTA,
  "ड़": "ड" + NUKTA, "ढ़": "ढ" + NUKTA, "फ़": "फ" + NUKTA, "य़": "य" + NUKTA,
};

function decompose(s: string): string {
  if (!/[क़-य़]/.test(s)) return s;
  return s.replace(/[क़-य़]/g, (c) => DECOMPOSED[c]);
}
