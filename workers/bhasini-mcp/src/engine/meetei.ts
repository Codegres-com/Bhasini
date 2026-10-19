import type { ScriptMapper } from "./types.ts";

// Port of Scripts/MeeteiMayekMapper.cs: Manipuri in Meetei Mayek (U+ABC0..U+ABFF). Syllable-final
// consonants use the lonsum letters; clusters keep the apun iyek (virama).

const APUN_IYEK = "꯭";

const MAP: Record<string, string> = {
  // consonants
  "क": "ꯀ", "ख": "ꯈ", "ग": "ꯒ", "घ": "ꯘ", "ङ": "ꯉ",
  "च": "ꯆ", "छ": "ꯆ", "ज": "ꯖ", "झ": "ꯓ", "ञ": "ꯅ",
  "ट": "ꯇ", "ठ": "ꯊ", "ड": "ꯗ", "ढ": "ꯙ", "ण": "ꯅ",
  "त": "ꯇ", "थ": "ꯊ", "द": "ꯗ", "ध": "ꯙ", "न": "ꯅ", "ऩ": "ꯅ",
  "प": "ꯄ", "फ": "ꯐ", "ब": "ꯕ", "भ": "ꯚ", "म": "ꯃ",
  "य": "ꯌ", "र": "ꯔ", "ऱ": "ꯔ", "ल": "ꯂ", "ळ": "ꯂ", "ऴ": "ꯂ", "व": "ꯋ",
  "श": "ꯁ", "ष": "ꯁ", "स": "ꯁ", "ह": "ꯍ",
  // independent vowels
  "अ": "ꯑ", "आ": "ꯑꯥ", "इ": "ꯏ", "ई": "ꯏ", "उ": "ꯎ", "ऊ": "ꯎ",
  "ऋ": "ꯔꯤ", "ए": "ꯑꯦ", "ऐ": "ꯑꯩ", "ओ": "ꯑꯣ", "औ": "ꯑꯧ",
  "ऎ": "ꯑꯦ", "ऒ": "ꯑꯣ", "ऍ": "ꯑꯦ", "ऑ": "ꯑꯣ",
  // vowel signs and marks
  "ा": "ꯥ", "ि": "ꯤ", "ी": "ꯤ", "ु": "ꯨ", "ू": "ꯨ", "ृ": "꯭ꯔꯤ",
  "े": "ꯦ", "ै": "ꯩ", "ो": "ꯣ", "ौ": "ꯧ",
  "ॆ": "ꯦ", "ॊ": "ꯣ", "ॅ": "ꯦ", "ॉ": "ꯣ",
  "ं": "ꯪ", "ँ": "ꯪ", "ः": "", "़": "", "ऽ": "", "्": "꯭",
  "।": "꯫", "॥": "꯫꯫",
};

const LONSUM: Record<string, string> = {
  "ꯀ": "ꯛ", "ꯂ": "ꯜ", "ꯃ": "ꯝ", "ꯄ": "ꯞ", "ꯅ": "ꯟ", "ꯇ": "ꯠ", "ꯉ": "ꯡ",
};

const REVERSE: Record<string, string> = {
  "ꯀ": "क", "ꯈ": "ख", "ꯒ": "ग", "ꯘ": "घ", "ꯉ": "ङ", "ꯆ": "च", "ꯖ": "ज",
  "ꯓ": "झ", "ꯇ": "त", "ꯊ": "थ", "ꯗ": "द", "ꯙ": "ध", "ꯅ": "न", "ꯄ": "प",
  "ꯐ": "फ", "ꯕ": "ब", "ꯚ": "भ", "ꯃ": "म", "ꯌ": "य", "ꯔ": "र", "ꯂ": "ल",
  "ꯋ": "व", "ꯁ": "स", "ꯍ": "ह",
  "ꯛ": "क्", "ꯜ": "ल्", "ꯝ": "म्", "ꯞ": "प्", "ꯟ": "न्", "ꯠ": "त्", "ꯡ": "ङ्", "ꯢ": "ई",
  "ꯑ": "अ", "ꯏ": "इ", "ꯎ": "उ",
  "ꯥ": "ा", "ꯤ": "ि", "ꯨ": "ु", "ꯦ": "े", "ꯩ": "ै", "ꯣ": "ो", "ꯧ": "ौ",
  "ꯪ": "ं", "꯭": "्", "꯫": "।", "꯬": "",
};

const ATIYA_WITH_SIGN: Record<string, string> = {
  "ꯥ": "आ", "ꯦ": "ए", "ꯩ": "ऐ", "ꯣ": "ओ", "ꯧ": "औ", "ꯤ": "इ", "ꯨ": "उ",
};

function isConsonant(c: string): boolean {
  return (c >= "ꯀ" && c <= "ꯍ") || (c >= "ꯐ" && c <= "ꯚ" && c !== "ꯑ");
}

export class MeeteiMayekMapper implements ScriptMapper {
  owns(c: string): boolean {
    return c >= "ꯀ" && c <= "꯿";
  }

  nativeDigit(digit: number): string {
    return String.fromCharCode(0xABF0 + digit);
  }

  fromDevanagari(deva: string, _phonetic: boolean): string {
    if (!deva) return "";

    let s = "";
    for (let i = 0; i < deva.length; i++) {
      const c = deva[i];
      const m = MAP[c];
      if (m !== undefined) s += m;
      else if (c >= "०" && c <= "९") s += this.nativeDigit(c.charCodeAt(0) - 0x0966);
      else s += c;
    }

    // Consonant + apun iyek: lonsum at a syllable end, apun kept for r/y/w clusters,
    // dropped at a word end when the consonant has no lonsum form.
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (isConsonant(c) && i + 1 < s.length && s[i + 1] === APUN_IYEK) {
        const next = i + 2 < s.length ? s[i + 2] : "\0";
        const cluster = isConsonant(next) && (next === "ꯔ" || next === "ꯌ" || next === "ꯋ");
        const lonsum = LONSUM[c];
        if (!cluster && lonsum !== undefined) {
          out += lonsum;
          i++;
          continue;
        }
        if (!isConsonant(next)) {
          out += c;
          i++;
          continue;
        }
      }
      out += c;
    }
    return out;
  }

  toDevanagari(text: string): string {
    if (!text) return "";
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const vowel = c === "ꯑ" && i + 1 < text.length ? ATIYA_WITH_SIGN[text[i + 1]] : undefined;
      if (vowel !== undefined) {
        out += vowel;
        i++;
        continue;
      }
      const r = REVERSE[c];
      if (r !== undefined) out += r;
      else if (c >= "꯰" && c <= "꯹") out += String.fromCharCode(0x0966 + (c.charCodeAt(0) - 0xABF0));
      else out += c;
    }
    return out;
  }
}
