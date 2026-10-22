// Translation routing, with Workers AI faked so the tests run offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { GEMMA, INDICTRANS2, translate, type Ai } from "../src/translate.ts";

// IndicTrans2 tags each sentence with the target; Gemma wraps the text in EN(...).
function fakeAi() {
  const calls: { model: string; inputs: any }[] = [];
  const ai: Ai = {
    async run(model, inputs: any) {
      calls.push({ model, inputs });
      if (model === INDICTRANS2) return { translations: inputs.text.map((s: string) => `${inputs.target_language}:${s}`) };
      if (model === GEMMA) return { response: ` EN(${inputs.messages[1].content}) ` };
      throw new Error(`unexpected model ${model}`);
    },
  };
  return { ai, calls };
}

test("English → Indic uses IndicTrans2 sentence by sentence, keeping line breaks", async () => {
  const { ai, calls } = fakeAi();
  const r = await translate(ai, { text: "Good morning. Where is the station?\n\nThanks!", target: "ta" });
  assert.equal(r.translation, "tam_Taml:Good morning. tam_Taml:Where is the station?\n\ntam_Taml:Thanks!");
  assert.deepEqual(r.models, [INDICTRANS2]);
  assert.equal(r.source, "en");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].inputs.text, ["Good morning.", "Where is the station?", "Thanks!"]);
});

test("every language maps to an IndicTrans2 tag", async () => {
  const { ai, calls } = fakeAi();
  for (const target of ["as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "ks-Deva", "kok", "mai", "ml", "mni", "mni-Beng", "mr", "ne", "or", "pa", "sa", "sat", "sd", "sd-Deva", "ta", "te", "ur", "Santali", "ᱥᱟᱱᱛᱟᱲᱤ"]) {
    await translate(ai, { text: "Hello.", source: "en", target });
  }
  assert.ok(calls.every((c) => /^[a-z]{3}_[A-Z][a-z]{3}$/.test(c.inputs.target_language)));
  assert.equal(calls.find((c) => c.inputs.target_language === "sat_Olck") !== undefined, true);
});

test("Indic → English uses Gemma and names the source language", async () => {
  const { ai, calls } = fakeAi();
  const r = await translate(ai, { text: "नमस्ते", source: "hi", target: "en" });
  assert.equal(r.translation, "EN(नमस्ते)");
  assert.deepEqual(r.models, [GEMMA]);
  assert.match(calls[0].inputs.messages[0].content, /from Hindi into natural English/);
});

test("Indic → Indic pivots through English", async () => {
  const { ai } = fakeAi();
  const r = await translate(ai, { text: "ನಮಸ್ಕಾರ", target: "hi" });
  assert.equal(r.translation, "hin_Deva:EN(ನಮಸ್ಕಾರ)");
  assert.deepEqual(r.models, [GEMMA, INDICTRANS2]);
  assert.equal(r.source, "auto");
});

test("same language, empty text and English → English cost nothing", async () => {
  const { ai, calls } = fakeAi();
  assert.equal((await translate(ai, { text: "नमस्ते", source: "hi", target: "Hindi" })).translation, "नमस्ते");
  assert.equal((await translate(ai, { text: "  ", target: "ta" })).translation, "  ");
  assert.equal((await translate(ai, { text: "Hello", target: "en" })).translation, "Hello");
  assert.equal(calls.length, 0);
});

test("bad input is a TranslateError with a clear message", async () => {
  const { ai } = fakeAi();
  await assert.rejects(translate(ai, { text: "x", target: "klingon" }), /Unknown target language 'klingon'/);
  await assert.rejects(translate(ai, { text: "x", target: "" }), /Unknown target language ''/);
  await assert.rejects(translate(ai, { text: 5, target: "hi" }), /'text' must be a string/);
  await assert.rejects(translate(ai, { text: "a".repeat(5001), target: "hi" }), /longer than 5000/);
});

// ---- HTTP ----

function call(path: string, body: unknown, env: object, method = "POST") {
  return worker.fetch(new Request(`https://mcp.bhasini.com${path}`, {
    method,
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }), env as any);
}

test("POST /v1/translate returns the translation and billable characters", async () => {
  const res = await call("/v1/translate", { text: "Hello.", target: "hi" }, { AI: fakeAi().ai });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(await res.json(), { translation: "hin_Deva:Hello.", source: "en", target: "hi", characters: 6, models: [INDICTRANS2], freeCharsLeftToday: 10_000 });
});

test("/v1/translate errors: 400 bad input, 405 GET, 503 switched off, 429 over quota", async () => {
  const { ai } = fakeAi();
  assert.equal((await call("/v1/translate", { text: "x", target: "zz" }, { AI: ai })).status, 400);
  assert.equal((await call("/v1/translate", null, { AI: ai }, "GET")).status, 405);
  assert.equal((await call("/v1/translate", { text: "x", target: "hi" }, { AI: ai, TRANSLATE_ENABLED: "false" })).status, 503);
  assert.equal((await call("/v1/translate", { text: "x", target: "hi" }, {})).status, 503);
  const limited = { AI: ai, TRANSLATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await call("/v1/translate", { text: "x", target: "hi" }, limited)).status, 429);
});

test("/v1/translate hides model failures behind a 502", async () => {
  const broken: Ai = { run: async () => ({ nope: true }) };
  const res = await call("/v1/translate", { text: "Hello.", target: "hi" }, { AI: broken });
  assert.equal(res.status, 502);
});

test("the MCP translate tool runs on Workers AI and respects the quota", async () => {
  const msg = { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "translate", arguments: { text: "Hello.", targetLanguage: "te" } } };
  const ok = await (await call("/mcp", msg, { AI: fakeAi().ai })).json() as any;
  assert.deepEqual(ok.result, { content: [{ type: "text", text: "tel_Telu:Hello." }] });

  const off = await (await call("/mcp", msg, {})).json() as any;
  assert.equal(off.result.isError, true);
  assert.match(off.result.content[0].text, /temporarily unavailable/);

  const limited = await (await call("/mcp", msg, { AI: fakeAi().ai, TRANSLATE_LIMITER: { limit: async () => ({ success: false }) } })).json() as any;
  assert.equal(limited.id, 7);
  assert.equal(limited.result.isError, true);
});
