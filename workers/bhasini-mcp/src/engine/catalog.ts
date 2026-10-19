import { BrahmicPhoneticEngine, C, V, type PhoneticProfile } from "./brahmic.ts";
import * as M from "./mappers.ts";
import { OffsetScriptMapper } from "./offset.ts";
import * as S from "./sequence.ts";
import type { ScriptMapper, Transliterator } from "./types.ts";

// Port of Languages/LanguageCatalog.cs and IndicLanguage.cs (without English).

export interface IndicLanguage {
  code: string;
  name: string;
  nativeName: string;
  scriptName: string;
  phonetic: Transliterator;
  mapper?: ScriptMapper;
  rightToLeft: boolean;
  sampleInput: string;
  punctuation: Record<string, string>;
  digit?: (d: number) => string;
}

export const supportsInscript = (l: IndicLanguage): boolean => l.mapper instanceof OffsetScriptMapper;

export const sample = (l: IndicLanguage): string =>
  l.sampleInput.length === 0 ? l.sampleInput : l.sampleInput.split(" ").map((w) => l.phonetic.render(w)).join(" ");

const NUKTA = "़";

const North: PhoneticProfile = {
  overrides: { "R": C("ड" + NUKTA), "Rh": C("ढ" + NUKTA), "Ri": V("ऋ", "ृ") },
};

const Sanskrit: PhoneticProfile = {
  finalVirama: true,
  overrides: { "R": V("ऋ", "ृ"), "Ri": V("ऋ", "ृ"), "RR": V("ॠ", "ॄ") },
};

const KannadaTelugu: PhoneticProfile = {
  dravidianVowels: true,
  finalVirama: true,
  overrides: {
    "R": V("ऋ", "ृ"), "Ru": V("ऋ", "ृ"), "RU": V("ॠ", "ॄ"),
    "nj": C("ञ"), "zh": C("ऴ"),
  },
};

const Tamil: PhoneticProfile = {
  dravidianVowels: true,
  finalVirama: true,
  tamilNasal: true,
  overrides: {
    "R": C("ऱ"), "zh": C("ऴ"), "nj": C("ञ"), "sh": C("ष"),
    // Tamil typists write ச as "s"; ஸ stays on "S".
    "s": C("च"), "S": C("स"),
  },
};

const Malayalam: PhoneticProfile = {
  dravidianVowels: true,
  finalVirama: true,
  overrides: {
    "R": C("ऱ"), "zh": C("ऴ"), "nj": C("ञ"),
    // Mozhi conventions: "nt" is ന്റ, "th"/"nth" are ത/ന്ത (thh for ഥ), "sh" is ഷ.
    "nt": C("न्ऱ"), "nth": C("न्त"), "sh": C("ष"),
    "th": C("त"), "thh": C("थ"),
  },
};

const Meetei: PhoneticProfile = {
  finalVirama: true,
  overrides: { "ng": C("ङ"), "ei": V("ऐ", "ै") },
};

const ARABIC_PUNCTUATION: Record<string, string> = { "?": "؟", ",": "،", ";": "؛", ".": "۔", "%": "٪" };
const arabicDigits = (d: number) => String.fromCharCode(0x06F0 + d);

function brahmic(code: string, name: string, nativeName: string, mapper: OffsetScriptMapper, scriptName: string,
  profile: PhoneticProfile, sampleInput: string): IndicLanguage {
  return {
    code, name, nativeName, scriptName, mapper, sampleInput,
    phonetic: new BrahmicPhoneticEngine(profile, mapper),
    rightToLeft: false,
    punctuation: {},
    digit: (d) => mapper.nativeDigit(d),
  };
}

function arabic(code: string, name: string, nativeName: string, map: Map<string, S.SequenceEntry>,
  groups: S.SequenceGroups, sampleInput: string): IndicLanguage {
  return {
    code, name, nativeName, scriptName: "Perso-Arabic", sampleInput,
    phonetic: new S.SequenceEngine(map, groups),
    rightToLeft: true,
    punctuation: ARABIC_PUNCTUATION,
    digit: arabicDigits,
  };
}

export const LANGUAGES: IndicLanguage[] = [
  brahmic("as", "Assamese", "অসমীয়া", M.Assamese, "Bengali-Assamese", North, "namaskAr"),
  brahmic("bn", "Bengali", "বাংলা", M.Bengali, "Bengali", North, "namaskAr bAMlA"),
  brahmic("brx", "Bodo", "बड़ो", M.Devanagari, "Devanagari", North, "baRo"),
  brahmic("doi", "Dogri", "डोगरी", M.Devanagari, "Devanagari", North, "DogarI"),
  brahmic("gu", "Gujarati", "ગુજરાતી", M.Gujarati, "Gujarati", North, "namaste gujarAtI"),
  brahmic("hi", "Hindi", "हिन्दी", M.Devanagari, "Devanagari", North, "namaste hindI"),
  brahmic("kn", "Kannada", "ಕನ್ನಡ", M.Kannada, "Kannada", KannadaTelugu, "namaskAra kannaDa"),
  arabic("ks", "Kashmiri", "کٲشُر", S.kashmiri(), S.KASHMIRI_GROUPS, "kashur"),
  brahmic("ks-Deva", "Kashmiri (Devanagari)", "कॉशुर", M.Devanagari, "Devanagari", North, "k^oshur"),
  brahmic("kok", "Konkani", "कोंकणी", M.Devanagari, "Devanagari", North, "koMkaNI"),
  brahmic("mai", "Maithili", "मैथिली", M.Devanagari, "Devanagari", North, "maithilI"),
  brahmic("ml", "Malayalam", "മലയാളം", M.Malayalam, "Malayalam", Malayalam, "namaskaaram malayaaLam"),
  {
    code: "mni",
    name: "Manipuri",
    nativeName: "ꯃꯤꯇꯩꯂꯣꯟ",
    scriptName: "Meetei Mayek",
    mapper: M.MeeteiMayek,
    phonetic: new BrahmicPhoneticEngine(Meetei, M.MeeteiMayek),
    rightToLeft: false,
    sampleInput: "meeteilon",
    punctuation: {},
    digit: (d) => M.MeeteiMayek.nativeDigit(d),
  },
  brahmic("mni-Beng", "Manipuri (Bengali)", "মৈতৈলোন্", M.Bengali, "Bengali", North, "maitailon"),
  brahmic("mr", "Marathi", "मराठी", M.Devanagari, "Devanagari", North, "namaskAr marAThI"),
  brahmic("ne", "Nepali", "नेपाली", M.Devanagari, "Devanagari", North, "namaste nepAlI"),
  brahmic("or", "Odia", "ଓଡ଼ିଆ", M.Odia, "Odia", North, "namaskAra o.DiA"),
  brahmic("pa", "Punjabi", "ਪੰਜਾਬੀ", M.Gurmukhi, "Gurmukhi", North, "sat srI akAl panjAbI"),
  brahmic("sa", "Sanskrit", "संस्कृतम्", M.Devanagari, "Devanagari", Sanskrit, "saMskRtam"),
  {
    code: "sat",
    name: "Santali",
    nativeName: "ᱥᱟᱱᱛᱟᱲᱤ",
    scriptName: "Ol Chiki",
    phonetic: new S.SequenceEngine(S.olChiki(), S.OL_CHIKI_GROUPS),
    rightToLeft: false,
    sampleInput: "santaRi",
    punctuation: { ".": "᱾", "|": "᱾" },
    digit: (d) => String.fromCharCode(0x1C50 + d),
  },
  arabic("sd", "Sindhi", "سنڌي", S.sindhi(), S.SINDHI_GROUPS, "sindhii"),
  brahmic("sd-Deva", "Sindhi (Devanagari)", "सिन्धी", M.Devanagari, "Devanagari", North, "sindhI"),
  brahmic("ta", "Tamil", "தமிழ்", M.Tamil, "Tamil", Tamil, "vaNakkam thamizh"),
  brahmic("te", "Telugu", "తెలుగు", M.Telugu, "Telugu", KannadaTelugu, "namaskAraM telugu"),
  arabic("ur", "Urdu", "اردو", S.urdu(), S.URDU_GROUPS, "aadaab urdu"),
];

// Code, name or native name; unknown languages are an error (unlike the editor, which falls back to Hindi).
export function findLanguage(language: string): IndicLanguage | undefined {
  const key = language.trim();
  return LANGUAGES.find((l) =>
    l.code.toLowerCase() === key.toLowerCase() || l.name.toLowerCase() === key.toLowerCase() || l.nativeName === key);
}
