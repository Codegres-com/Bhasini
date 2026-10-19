// The Worker's HTTP behaviour, called the way Cloudflare calls it.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";

const URL_MCP = "https://mcp.bhasini.com/mcp";

function post(body: unknown, env = {}, headers: Record<string, string> = {}) {
  return worker.fetch(new Request(URL_MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }), env);
}

async function rpc(method: string, params?: unknown, id: number = 1) {
  const res = await post({ jsonrpc: "2.0", id, method, params });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /application\/json/);
  return res.json() as Promise<any>;
}

test("initialize echoes a supported protocol version", async () => {
  const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(r.result.protocolVersion, "2025-06-18");
  assert.equal(r.result.serverInfo.name, "bhasini");
  assert.deepEqual(r.result.capabilities, { tools: { listChanged: false } });
});

test("initialize answers an unknown version with the latest", async () => {
  const r = await rpc("initialize", { protocolVersion: "1999-01-01" });
  assert.equal(r.result.protocolVersion, "2025-11-25");
});

test("notifications get 202 with no body", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("tools/list returns the five tools", async () => {
  const r = await rpc("tools/list");
  assert.deepEqual(r.result.tools.map((t: any) => t.name).sort(), ["convert_script", "get_keymap", "list_languages", "native_digits", "transliterate"]);
});

test("tools/call runs a tool", async () => {
  const r = await rpc("tools/call", { name: "transliterate", arguments: { text: "vaNakkam, nanRi!", language: "Tamil" } });
  assert.deepEqual(r.result, { content: [{ type: "text", text: "வணக்கம், நன்றி!" }] });

  const c = await rpc("tools/call", { name: "convert_script", arguments: { text: "नमस्ते भारत", targetLanguage: "kn" } });
  assert.equal(c.result.content[0].text, "ನಮಸ್ತೇ ಭಾರತ");
});

test("tool failures are isError results with the C# message", async () => {
  const r = await rpc("tools/call", { name: "transliterate", arguments: { text: "x", language: "klingon" } });
  assert.equal(r.result.isError, true);
  assert.equal(r.result.content[0].text, "An error occurred invoking 'transliterate': Unknown language 'klingon'. Call list_languages for the supported codes.");

  const u = await rpc("tools/call", { name: "convert_script", arguments: { text: "नमस्ते", targetLanguage: "ur" } });
  assert.equal(u.result.content[0].text, "An error occurred invoking 'convert_script': Urdu (Perso-Arabic) is not a script conversion target. Use transliterate with romanised text instead.");
});

test("unknown tool and unknown method are JSON-RPC errors", async () => {
  assert.equal((await rpc("tools/call", { name: "nope", arguments: {} })).error.code, -32602);
  assert.equal((await rpc("does/not/exist")).error.code, -32601);
});

test("invalid JSON is a 400 parse error", async () => {
  const res = await post("{not json");
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as any).error.code, -32700);
});

test("oversized bodies are rejected", async () => {
  const res = await post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "transliterate", arguments: { text: "a".repeat(70_000), language: "hi" } } });
  assert.equal(res.status, 413);
});

test("batches get an array of responses", async () => {
  const res = await post([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  const body = (await res.json()) as any[];
  assert.deepEqual(body.map((r) => r.id), [1, 2]);
});

test("GET is 405 for MCP clients and redirects browsers to the docs", async () => {
  const sse = await worker.fetch(new Request(URL_MCP, { headers: { Accept: "text/event-stream" } }), {});
  assert.equal(sse.status, 405);
  const page = await worker.fetch(new Request(URL_MCP, { headers: { Accept: "text/html" } }), {});
  assert.equal(page.status, 302);
  assert.equal(page.headers.get("Location"), "https://bhasini.com/mcp/");
});

test("CORS preflight is allowed", async () => {
  const res = await worker.fetch(new Request(URL_MCP, { method: "OPTIONS" }), {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});

test("rate limiting returns 429", async () => {
  const limited = { RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const res = await post({ jsonrpc: "2.0", id: 1, method: "ping" }, limited);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "60");
});

test("serves the OpenAI domain token as plain text", async () => {
  const env = { OPENAI_APPS_CHALLENGE: "TOKEN123" };
  const res = await worker.fetch(new Request("https://mcp.bhasini.com/.well-known/openai-apps-challenge"), env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Content-Type") ?? "", /^text\/plain/);
  assert.equal(await res.text(), "TOKEN123");
  const missing = await worker.fetch(new Request("https://mcp.bhasini.com/.well-known/openai-apps-challenge"), {});
  assert.equal(missing.status, 404);
});

test("other paths are 404", async () => {
  const res = await worker.fetch(new Request("https://mcp.bhasini.com/other"), {});
  assert.equal(res.status, 404);
});
