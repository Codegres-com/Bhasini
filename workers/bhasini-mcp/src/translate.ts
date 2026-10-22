import { findLanguage } from "./engine/catalog.ts";

// Translation between English and the 22 scheduled languages on Cloudflare Workers AI.
//   English → Indic: AI4Bharat IndicTrans2 (only translates out of English).
//   Indic → English: Gemma 4, prompted as a translator.
//   Indic → Indic:   Gemma to English, then IndicTrans2 to the target (English pivot).
// See docs/TRANSLATION_API_PLAN.md for why.

export const INDICTRANS2 = "@cf/ai4bharat/indictrans2-en-indic-1B";
export const GEMMA = "@cf/google/gemma-4-26b-a4b-it";

// The most any caller may send in one request (paid keys, later); free callers get less (quota.ts).
export const MAX_TRANSLATE_CHARS = 5_000;

// Workers AI binding (wrangler.toml [ai]); a fake in tests.
export interface Ai {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

// A bad request: reported as 400 on the REST API and as an isError result over MCP.
export class TranslateError extends Error {}

// Bhasini language codes → IndicTrans2 (FLORES-200) tags.
const FLORES: Record<string, string> = {
  en: "eng_Latn",
  as: "asm_Beng",
  bn: "ben_Beng",
  brx: "brx_Deva",
  doi: "doi_Deva",
  gu: "guj_Gujr",
  hi: "hin_Deva",
  kn: "kan_Knda",
  ks: "kas_Arab",
  "ks-Deva": "kas_Deva",
  kok: "gom_Deva",
  mai: "mai_Deva",
  ml: "mal_Mlym",
  mni: "mni_Mtei",
  "mni-Beng": "mni_Beng",
  mr: "mar_Deva",
  ne: "npi_Deva",
  or: "ory_Orya",
  pa: "pan_Guru",
  sa: "san_Deva",
  sat: "sat_Olck",
  sd: "snd_Arab",
  "sd-Deva": "snd_Deva",
  ta: "tam_Taml",
  te: "tel_Telu",
  ur: "urd_Arab",
};

export interface Lang {
  code: string;
  name: string;
}

const ENGLISH: Lang = { code: "en", name: "English" };

// Code, name or native name, as the other tools accept, plus English. "auto" (or empty) is only
// allowed for the source.
export function resolveLanguage(value: unknown, role: "source" | "target"): Lang | undefined {
  const key = typeof value === "string" ? value.trim() : "";
  if (role === "source" && (key === "" || key.toLowerCase() === "auto")) return undefined;
  if (key.toLowerCase() === "en" || key.toLowerCase() === "english") return ENGLISH;
  const match = findLanguage(key);
  if (!match) throw new TranslateError(`Unknown ${role} language '${key}'. Use a code from list_languages, or 'en' for English.`);
  return { code: match.code, name: match.name };
}

// Latin letters with no Indic letters means English; anything else is treated as Indic.
const INDIC_LETTER = /[ऀ-෿؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿᱐-᱿ꯀ-꯿ꫠ-꫿]/;
export const looksEnglish = (text: string): boolean => !INDIC_LETTER.test(text) && /[A-Za-z]/.test(text);

export interface TranslateRequest {
  text: unknown;
  source?: unknown;
  target: unknown;
}

export interface TranslateResult {
  translation: string;
  source: string; // language code, or "auto" when Gemma detected it
  target: string;
  characters: number; // billable source characters (code points)
  models: string[];
}

export async function translate(ai: Ai, request: TranslateRequest, maxChars = MAX_TRANSLATE_CHARS): Promise<TranslateResult> {
  if (typeof request.text !== "string") throw new TranslateError("'text' must be a string.");
  const text = request.text;
  const characters = [...text].length;
  if (characters > maxChars) {
    throw new TranslateError(`'text' is longer than ${maxChars} characters. Split it into smaller pieces.`);
  }
  const target = resolveLanguage(request.target, "target");
  if (!target) throw new TranslateError("'target' is required.");
  const named = resolveLanguage(request.source, "source");
  const source = named ?? (looksEnglish(text) ? ENGLISH : undefined);
  const result = (translation: string, models: string[]): TranslateResult =>
    ({ translation, source: source?.code ?? "auto", target: target.code, characters, models });

  if (text.trim() === "" || (source && source.code === target.code)) return result(text, []);

  // Into English first unless the text already is English.
  let english = text;
  const models: string[] = [];
  if (source?.code !== "en") {
    english = await toEnglish(ai, text, source);
    models.push(GEMMA);
  }
  if (target.code === "en") return result(english, models);

  models.push(INDICTRANS2);
  return result(await fromEnglish(ai, english, FLORES[target.code]), models);
}

// ---- English → Indic (IndicTrans2) ----

// IndicTrans2 is a sentence model: translate sentence by sentence, keeping line breaks.
const SENTENCE_END = /(?<=[.!?…])\s+(?=\S)/u;
const BATCH = 32;

async function fromEnglish(ai: Ai, text: string, targetTag: string): Promise<string> {
  const lines = text.split(/\r?\n/);
  const sentences: string[] = [];
  const shape = lines.map((line) => {
    const parts = line.trim() === "" ? [] : line.trim().split(SENTENCE_END);
    sentences.push(...parts);
    return parts.length;
  });

  const translated: string[] = [];
  for (let i = 0; i < sentences.length; i += BATCH) {
    const batch = sentences.slice(i, i + BATCH);
    const response = await ai.run(INDICTRANS2, { text: batch, target_language: targetTag });
    const out = (response as { translations?: unknown }).translations;
    if (!Array.isArray(out) || out.length !== batch.length) throw new Error("IndicTrans2 returned an unexpected response");
    translated.push(...out.map(String));
  }

  let next = 0;
  return shape.map((count) => translated.slice(next, (next += count)).join(" ")).join("\n");
}

// ---- Indic → English (Gemma) ----

async function toEnglish(ai: Ai, text: string, source: Lang | undefined): Promise<string> {
  const from = source ? `from ${source.name}` : "from the Indian language it is written in";
  const response = await ai.run(GEMMA, {
    messages: [
      {
        role: "system",
        content: `You are a translation engine. Translate the user's text ${from} into natural English. ` +
          "Keep the meaning, names, numbers and line breaks. Reply with the translation only: no notes, quotes or explanations.",
      },
      { role: "user", content: text },
    ],
    max_tokens: Math.min(8192, 256 + text.length * 2),
    temperature: 0,
    // Gemma 4 reasons before answering by default: 3-4x slower, and the reasoning eats max_tokens.
    chat_template_kwargs: { enable_thinking: false },
  });
  const r = response as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const out = r.response ?? r.choices?.[0]?.message?.content;
  if (typeof out !== "string" || out.trim() === "") throw new Error("Gemma returned no translation");
  return out.trim();
}
