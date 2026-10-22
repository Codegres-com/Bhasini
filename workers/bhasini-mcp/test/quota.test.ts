// Free translation limits: the real TranslateQuota Durable Object on in-memory storage, with
// Workers AI and the per-minute rate limiter faked.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { freeTranslate, istDay, LimitError, TranslateQuota, type QuotaNamespace, type QuotaState } from "../src/quota.ts";
import { GEMMA, INDICTRANS2, TranslateError, type Ai } from "../src/translate.ts";

// A namespace of real TranslateQuota objects, one per name, each with its own Map storage.
function fakeQuota() {
  const objects = new Map<string, { quota: TranslateQuota; data: Map<string, unknown>; alarm?: number }>();
  const ns: QuotaNamespace = {
    idFromName: (name) => name,
    get(id) {
      const name = id as string;
      let entry = objects.get(name);
      if (!entry) {
        const data = new Map<string, unknown>();
        const e: { quota: TranslateQuota; data: Map<string, unknown>; alarm?: number } = { quota: undefined!, data };
        const state: QuotaState = {
          storage: {
            get: async <T>(key: string) => data.get(key) as T | undefined,
            put: async (key, value) => void data.set(key, value),
            deleteAll: async () => data.clear(),
            setAlarm: async (time) => void (e.alarm = time),
          },
        };
        e.quota = new TranslateQuota(state);
        objects.set(name, (entry = e));
      }
      const target = entry;
      return { fetch: (input: string, init: RequestInit) => target.quota.fetch(new Request(input, init)) };
    },
  };
  const used = (prefix: string) =>
    [...objects].filter(([n]) => n.startsWith(prefix)).reduce((sum, [, e]) => sum + ((e.data.get("used") as number) ?? 0), 0);
  return { ns, objects, used };
}

const okAi: Ai = {
  async run(model, inputs: any) {
    if (model === INDICTRANS2) return { translations: inputs.text.map((s: string) => `t:${s}`) };
    if (model === GEMMA) return { response: "EN" };
    throw new Error(model);
  },
};
const brokenAi: Ai = { run: async () => ({}) };
const allow = { limit: async () => ({ success: true }) };

function env(over: Record<string, unknown> = {}) {
  const q = fakeQuota();
  return { q, env: { AI: okAi, TRANSLATE_QUOTA: q.ns, TRANSLATE_LIMITER: allow, ...over } as any };
}

const NOON_IST = Date.UTC(2026, 9, 22, 6, 30); // 22 Oct 2026, 12:00 IST

test("days run on India time", () => {
  assert.deepEqual(istDay(Date.UTC(2026, 9, 21, 18, 29)), { day: "2026-10-21", ends: Date.UTC(2026, 9, 21, 18, 30) });
  assert.equal(istDay(Date.UTC(2026, 9, 21, 18, 30)).day, "2026-10-22");
  assert.equal(istDay(NOON_IST).day, "2026-10-22");
});

test("a request over 2,000 characters is refused before anything is counted", async () => {
  const { q, env: e } = env();
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "a".repeat(2001), target: "hi" }, NOON_IST), (err: unknown) =>
    err instanceof TranslateError && /up to 2,000 characters at a time; this text has 2,001/.test(err.message));
  assert.equal(q.used(""), 0);
  // Exactly 2,000 is fine; characters are code points, so Indic text counts letter by letter.
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await freeTranslate(e, "1.1.1.1", { text: "क".repeat(2000), target: "en" }, NOON_IST);
});

test("each IP gets 10,000 characters a day, counted exactly", async () => {
  const { q, env: e } = env();
  const text = "a".repeat(2000);
  for (let i = 0; i < 5; i++) {
    const r = await freeTranslate(e, "1.1.1.1", { text, target: "hi" }, NOON_IST);
    assert.equal(r.freeCharsLeftToday, 10_000 - 2000 * (i + 1));
  }
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "Hi", target: "hi" }, NOON_IST), (err: unknown) =>
    err instanceof LimitError && /today's free translation allowance \(10,000 characters; 0 left, this text needs 2\)/.test(err.message) &&
    err.retryAfterSeconds === 12 * 60 * 60);
  // A refused request is not counted, for the IP or globally.
  assert.equal(q.used("ip:"), 10_000);
  assert.equal(q.used("global:"), 10_000);
  // Another IP is unaffected, and the next IST day starts fresh.
  assert.equal((await freeTranslate(e, "2.2.2.2", { text, target: "hi" }, NOON_IST)).freeCharsLeftToday, 8000);
  assert.equal((await freeTranslate(e, "1.1.1.1", { text, target: "hi" }, NOON_IST + 24 * 3600_000)).freeCharsLeftToday, 8000);
});

test("a partial allowance still allows text that fits", async () => {
  const { env: e } = env();
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(1500), target: "hi" }, NOON_IST);
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "a".repeat(501), target: "hi" }, NOON_IST), /500 left, this text needs 501/);
  assert.equal((await freeTranslate(e, "1.1.1.1", { text: "a".repeat(500), target: "hi" }, NOON_IST)).freeCharsLeftToday, 0);
});

test("the global daily budget stops all free translation and gives the IP its characters back", async () => {
  const { q, env: e } = env({ FREE_DAILY_CHARS_GLOBAL: "3000" });
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(2000), target: "hi" }, NOON_IST);
  await assert.rejects(freeTranslate(e, "2.2.2.2", { text: "a".repeat(1001), target: "hi" }, NOON_IST), (err: unknown) =>
    err instanceof LimitError && /today's limit for all users/.test(err.message));
  assert.equal(q.used("global:"), 2000);
  assert.equal(q.used("ip:"), 2000); // 2.2.2.2's reservation was refunded
  await freeTranslate(e, "2.2.2.2", { text: "a".repeat(1000), target: "hi" }, NOON_IST);
});

test("failed translations, bad input and no-op requests are not counted", async () => {
  const { q, env: e } = env();
  await assert.rejects(freeTranslate({ ...e, AI: brokenAi }, "1.1.1.1", { text: "Hello.", target: "hi" }, NOON_IST));
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "Hello.", target: "klingon" }, NOON_IST), TranslateError);
  const same = await freeTranslate(e, "1.1.1.1", { text: "नमस्ते", source: "hi", target: "hi" }, NOON_IST);
  assert.equal(same.freeCharsLeftToday, 10_000);
  assert.equal(q.used(""), 0);
});

test("the per-minute limiter runs before anything is counted", async () => {
  const { q, env: e } = env({ TRANSLATE_LIMITER: { limit: async () => ({ success: false }) } });
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "Hello.", target: "hi" }, NOON_IST), (err: unknown) =>
    err instanceof LimitError && /5 requests a minute/.test(err.message) && err.retryAfterSeconds === 60);
  assert.equal(q.used(""), 0);
});

test("counters are keyed by a hash of the IP and delete themselves after their day", async () => {
  const { q, env: e } = env();
  await freeTranslate(e, "203.0.113.9", { text: "Hello.", target: "hi" }, NOON_IST);
  const names = [...q.objects.keys()];
  assert.ok(names.every((n) => !n.includes("203.0.113.9")));
  assert.ok(names.some((n) => /^ip:2026-10-22:[0-9a-f]{64}$/.test(n)));
  const entry = q.objects.get(names.find((n) => n.startsWith("ip:"))!)!;
  assert.equal(entry.alarm, Date.UTC(2026, 9, 22, 18, 30) + 3600_000); // midnight IST + 1 hour
  await entry.quota.alarm();
  assert.equal(entry.data.size, 0);
});

test("settings come from wrangler.toml vars", async () => {
  const { env: e } = env({ FREE_MAX_CHARS_PER_REQUEST: "10", FREE_DAILY_CHARS_PER_IP: "15" });
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "a".repeat(11), target: "hi" }, NOON_IST), /up to 10 characters/);
  await freeTranslate(e, "1.1.1.1", { text: "a".repeat(10), target: "hi" }, NOON_IST);
  await assert.rejects(freeTranslate(e, "1.1.1.1", { text: "a".repeat(6), target: "hi" }, NOON_IST), LimitError);
});

// ---- Through the Worker ----

function call(path: string, body: unknown, e: object) {
  return worker.fetch(new Request(`https://mcp.bhasini.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "9.9.9.9" },
    body: JSON.stringify(body),
  }), e as any);
}

test("/v1/translate reports the allowance and answers 429 with Retry-After when it is used up", async () => {
  const { env: e } = env({ FREE_DAILY_CHARS_PER_IP: "8" });
  const ok = await call("/v1/translate", { text: "Hello.", target: "hi" }, e);
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as any).freeCharsLeftToday, 2);
  const over = await call("/v1/translate", { text: "Hello.", target: "hi" }, e);
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get("Retry-After")) >= 60);
  assert.match(((await over.json()) as any).error, /resets at midnight IST/);
  const big = await call("/v1/translate", { text: "a".repeat(2001), target: "hi" }, e);
  assert.equal(big.status, 400);
});

test("MCP batches can't get round the limits: each translate call is counted", async () => {
  let minute = 0;
  const { q, env: e } = env({ TRANSLATE_LIMITER: { limit: async () => ({ success: ++minute <= 5 }) } });
  const batch = Array.from({ length: 8 }, (_, i) => ({
    jsonrpc: "2.0", id: i, method: "tools/call", params: { name: "translate", arguments: { text: "a".repeat(2000), targetLanguage: "hi" } },
  }));
  const res = (await (await call("/mcp", batch, e)).json()) as any[];
  assert.equal(res.length, 8);
  // Five fit the daily allowance; the per-minute limiter refuses the rest.
  assert.deepEqual(res.map((r) => r.result.isError === true), [false, false, false, false, false, true, true, true]);
  assert.equal(q.used("ip:"), 10_000);
  assert.equal(minute, 8);

  // With the minute limit lifted, the daily allowance still holds.
  const { q: q2, env: e2 } = env();
  const res2 = (await (await call("/mcp", batch, e2)).json()) as any[];
  assert.deepEqual(res2.map((r) => r.result.isError === true), [false, false, false, false, false, true, true, true]);
  assert.match(res2[5].result.content[0].text, /today's free translation allowance/);
  assert.equal(q2.used("ip:"), 10_000);
});

test("a single MCP translate call over the per-request limit is an isError result", async () => {
  const { env: e } = env();
  const r = (await (await call("/mcp", {
    jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "translate", arguments: { text: "a".repeat(2001), targetLanguage: "hi" } },
  }, e)).json()) as any;
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /up to 2,000 characters/);
});
