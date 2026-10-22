// Translation API accounts and Razorpay billing, through the Worker, on SQLite (test/d1.ts) with
// Workers AI and Razorpay's API faked.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";
import { paymentSignature, razorpayApi, webhookSignature } from "../src/billing.ts";
import { INDICTRANS2, type Ai } from "../src/translate.ts";
import { fakeD1 } from "./d1.ts";

const ai: Ai = {
  async run(model, inputs: any) {
    if (model === INDICTRANS2) return { translations: inputs.text.map((s: string) => `hi:${s}`) };
    return { response: "EN" };
  },
};

const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

function setup(over: Record<string, unknown> = {}) {
  const DB = fakeD1();
  const env = { AI: ai, DB, RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET, ...over };
  const orders: any[] = [];
  razorpayApi.fetch = async (url, init) => {
    assert.equal(url, "https://api.razorpay.com/v1/orders");
    assert.equal((init.headers as any).Authorization, "Basic " + btoa(`rzp_test_abc:${KEY_SECRET}`));
    const body = JSON.parse(String(init.body));
    const order = { id: `order_${orders.length + 1}`, ...body };
    orders.push(order);
    return Response.json(order);
  };
  const call = async (method: string, path: string, body?: unknown, key?: string, ip = "7.7.7.7", headers: Record<string, string> = {}) => {
    const res = await worker.fetch(new Request(`https://mcp.bhasini.com${path}`, {
      method,
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip, ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }), env as any);
    return { status: res.status, headers: res.headers, body: (await res.json()) as any };
  };
  return { DB, env, call, orders };
}

async function signedUp(s: ReturnType<typeof setup>, email = "dev@example.com") {
  const r = await s.call("POST", "/v1/account/signup", { email, name: "Dev" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.apiKey as string;
}

// ---- Accounts ----

test("sign-up returns a key once, stores only its hash, and starts with 10,000 free characters", async () => {
  const s = setup();
  const r = await s.call("POST", "/v1/account/signup", { email: " Dev@Example.com ", name: "Dev" });
  assert.equal(r.status, 200);
  assert.match(r.body.apiKey, /^bk_live_[A-Za-z0-9]{32}$/);
  assert.equal(r.body.account.email, "dev@example.com");
  assert.equal(r.body.account.credits, 10_000);
  assert.equal(r.body.account.keyPrefix, r.body.apiKey.slice(0, 12));

  const row = s.DB.sqlite.prepare("SELECT * FROM accounts").get() as any;
  assert.notEqual(row.key_hash, r.body.apiKey);
  assert.ok(!JSON.stringify(row).includes(r.body.apiKey));
  assert.ok(!JSON.stringify(row).includes("7.7.7.7"));

  const me = await s.call("GET", "/v1/account", undefined, r.body.apiKey);
  assert.equal(me.status, 200);
  assert.equal(me.body.credits, 10_000);
});

test("sign-up refuses bad emails, duplicates and more than 3 accounts a day per IP", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/v1/account/signup", { email: "nope" })).status, 400);
  await signedUp(s, "a@example.com");
  const dup = await s.call("POST", "/v1/account/signup", { email: "A@example.com" });
  assert.equal(dup.status, 409);
  await signedUp(s, "b@example.com");
  await signedUp(s, "c@example.com");
  const fourth = await s.call("POST", "/v1/account/signup", { email: "d@example.com" });
  assert.equal(fourth.status, 429);
  assert.equal((await s.call("POST", "/v1/account/signup", { email: "d@example.com" }, undefined, "8.8.8.8")).status, 200);
});

test("bad or missing keys are 401", async () => {
  const s = setup();
  assert.equal((await s.call("GET", "/v1/account")).status, 401);
  assert.equal((await s.call("GET", "/v1/account", undefined, "bk_live_" + "x".repeat(32))).status, 401);
  assert.equal((await s.call("GET", "/v1/account", undefined, "garbage")).status, 401);
  const res = await s.call("POST", "/v1/translate", { text: "Hi", target: "hi" }, undefined, "7.7.7.7", { Authorization: "Basic abc" });
  assert.equal(res.status, 401);
});

test("rotating the key invalidates the old one", async () => {
  const s = setup();
  const oldKey = await signedUp(s);
  const r = await s.call("POST", "/v1/account/rotate-key", undefined, oldKey);
  assert.equal(r.status, 200);
  assert.notEqual(r.body.apiKey, oldKey);
  assert.equal((await s.call("GET", "/v1/account", undefined, oldKey)).status, 401);
  assert.equal((await s.call("GET", "/v1/account", undefined, r.body.apiKey)).body.credits, 10_000);
});

// ---- Paid translation ----

test("translating with a key charges credits, records usage and skips the free limits", async () => {
  const s = setup({ TRANSLATE_LIMITER: { limit: async () => ({ success: false }) } }); // free limit exhausted
  const key = await signedUp(s);
  const r = await s.call("POST", "/v1/translate", { text: "Hello.", target: "hi" }, key);
  assert.equal(r.status, 200);
  assert.equal(r.body.translation, "hi:Hello.");
  assert.equal(r.body.creditsLeft, 10_000 - 6);
  assert.equal(r.body.freeCharsLeftToday, undefined);

  const me = (await s.call("GET", "/v1/account", undefined, key)).body;
  assert.equal(me.credits, 9_994);
  assert.equal(me.usage.length, 1);
  assert.deepEqual({ chars: me.usage[0].chars, requests: me.usage[0].requests }, { chars: 6, requests: 1 });

  // Paid requests may be up to 5,000 characters (free: 2,000).
  assert.equal((await s.call("POST", "/v1/translate", { text: "a".repeat(5000), target: "hi" }, key)).status, 200);
  assert.equal((await s.call("POST", "/v1/translate", { text: "a".repeat(5001), target: "hi" }, key)).status, 400);
});

test("no credits means 402, and failed translations are refunded", async () => {
  const s = setup({ SIGNUP_FREE_CHARS: "10" });
  const key = await signedUp(s);
  const short = await s.call("POST", "/v1/translate", { text: "a".repeat(11), target: "hi" }, key);
  assert.equal(short.status, 402);
  assert.match(short.body.error, /10 characters left, this text needs 11/);

  assert.equal((await s.call("POST", "/v1/translate", { text: "Hello", target: "klingon" }, key)).status, 400);
  (s.env as any).AI = { run: async () => ({}) };
  assert.equal((await s.call("POST", "/v1/translate", { text: "Hello", target: "hi" }, key)).status, 502);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 10);
});

test("credits never go below zero under concurrent requests", async () => {
  const s = setup({ SIGNUP_FREE_CHARS: "100" });
  const key = await signedUp(s);
  const results = await Promise.all(Array.from({ length: 6 }, () => s.call("POST", "/v1/translate", { text: "a".repeat(30), target: "hi" }, key)));
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal(results.filter((r) => r.status === 402).length, 3);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 10);
});

test("the MCP translate tool uses the account when a key is sent", async () => {
  const s = setup({ TRANSLATE_LIMITER: { limit: async () => ({ success: false }) } });
  const key = await signedUp(s);
  const msg = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "translate", arguments: { text: "Hello.", targetLanguage: "hi" } } };
  const paid = await s.call("POST", "/mcp", msg, key);
  assert.deepEqual(paid.body.result, { content: [{ type: "text", text: "hi:Hello." }] });
  const bad = await s.call("POST", "/mcp", msg, "bk_live_" + "y".repeat(32));
  assert.equal(bad.body.result.isError, true);
  assert.match(bad.body.result.content[0].text, /Invalid API key/);
});

// ---- Billing ----

test("packs are public and say whether payments are set up", async () => {
  const s = setup();
  const r = await s.call("GET", "/v1/billing/packs");
  assert.equal(r.body.razorpayKeyId, "rzp_test_abc");
  assert.equal(r.body.payments, true);
  assert.equal(r.body.charsPerRupee, 2000); // ₹5 per 10,000 characters
  assert.deepEqual(r.body.packs.map((p: any) => [p.id, p.rupees, p.chars]), [["starter", 500, 1_000_000], ["growth", 2000, 4_400_000], ["scale", 5000, 12_000_000]]);
  const off = setup({ RAZORPAY_KEY_SECRET: undefined });
  assert.equal((await off.call("GET", "/v1/billing/packs")).body.payments, false);
});

test("buying a pack: order, Checkout signature, credits added exactly once", async () => {
  const s = setup();
  const key = await signedUp(s);
  const order = await s.call("POST", "/v1/billing/order", { pack: "growth" }, key);
  assert.equal(order.status, 200);
  assert.equal(order.body.amount, 200_000);
  assert.equal(order.body.keyId, "rzp_test_abc");
  assert.equal(order.body.email, "dev@example.com");
  assert.equal(s.orders[0].amount, 200_000);
  assert.equal(s.orders[0].currency, "INR");

  const orderId = order.body.orderId;
  const signature = await paymentSignature(KEY_SECRET, orderId, "pay_1");
  const verified = await s.call("POST", "/v1/billing/verify", { razorpay_order_id: orderId, razorpay_payment_id: "pay_1", razorpay_signature: signature }, key);
  assert.equal(verified.status, 200);
  assert.equal(verified.body.credits, 10_000 + 4_400_000);
  assert.equal(verified.body.payments.length, 1);
  assert.equal(verified.body.payments[0].paymentId, "pay_1");

  // Verifying again, or the webhook arriving later, adds nothing.
  await s.call("POST", "/v1/billing/verify", { razorpay_order_id: orderId, razorpay_payment_id: "pay_1", razorpay_signature: signature }, key);
  const event = JSON.stringify({ event: "order.paid", payload: { payment: { entity: { id: "pay_1", order_id: orderId, amount: 200_000 } }, order: { entity: { id: orderId } } } });
  const hook = await s.call("POST", "/v1/billing/webhook", event, undefined, "1.1.1.1", { "X-Razorpay-Signature": await webhookSignature(WEBHOOK_SECRET, event) });
  assert.equal(hook.status, 200);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 4_410_000);
});

test("a forged Checkout signature, an unknown pack or someone else's order adds nothing", async () => {
  const s = setup();
  const key = await signedUp(s);
  const other = await signedUp(s, "other@example.com");
  assert.equal((await s.call("POST", "/v1/billing/order", { pack: "gold" }, key)).status, 400);
  const { orderId } = (await s.call("POST", "/v1/billing/order", { pack: "starter" }, key)).body;

  const forged = await s.call("POST", "/v1/billing/verify", { razorpay_order_id: orderId, razorpay_payment_id: "pay_9", razorpay_signature: "0".repeat(64) }, key);
  assert.equal(forged.status, 400);
  const sig = await paymentSignature(KEY_SECRET, orderId, "pay_9");
  const stolen = await s.call("POST", "/v1/billing/verify", { razorpay_order_id: orderId, razorpay_payment_id: "pay_9", razorpay_signature: sig }, other);
  assert.equal(stolen.status, 404);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 10_000);
  assert.equal((await s.call("GET", "/v1/account", undefined, other)).body.credits, 10_000);
});

test("the webhook alone adds credits (customer closed the tab), and checks its signature", async () => {
  const s = setup();
  const key = await signedUp(s);
  const { orderId } = (await s.call("POST", "/v1/billing/order", { pack: "starter" }, key)).body;
  const event = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_2", order_id: orderId, amount: 50_000 } } } });

  const unsigned = await s.call("POST", "/v1/billing/webhook", event);
  assert.equal(unsigned.status, 400);
  const wrong = await s.call("POST", "/v1/billing/webhook", event, undefined, "1.1.1.1", { "X-Razorpay-Signature": await webhookSignature("nope", event) });
  assert.equal(wrong.status, 400);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 10_000);

  const ok = await s.call("POST", "/v1/billing/webhook", event, undefined, "1.1.1.1", { "X-Razorpay-Signature": await webhookSignature(WEBHOOK_SECRET, event) });
  assert.equal(ok.status, 200);
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 1_010_000);

  // Other events and orders we didn't create are acknowledged and ignored.
  for (const other of [
    JSON.stringify({ event: "refund.created", payload: {} }),
    JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_3", order_id: "order_sponsor", amount: 100 } } } }),
  ]) {
    const r = await s.call("POST", "/v1/billing/webhook", other, undefined, "1.1.1.1", { "X-Razorpay-Signature": await webhookSignature(WEBHOOK_SECRET, other) });
    assert.equal(r.status, 200);
  }
  assert.equal((await s.call("GET", "/v1/account", undefined, key)).body.credits, 1_010_000);
});

test("without Razorpay keys, buying is refused politely", async () => {
  const s = setup({ RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: undefined });
  const key = await signedUp(s);
  const r = await s.call("POST", "/v1/billing/order", { pack: "starter" }, key);
  assert.equal(r.status, 503);
  assert.match(r.body.error, /Payments are not set up yet/);
});
