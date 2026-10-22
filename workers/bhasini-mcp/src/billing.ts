import { ApiError, summary, type Account, type AccountsEnv } from "./accounts.ts";

// Prepaid translation credits through Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/):
//   1. POST /v1/billing/order   the Worker creates a Razorpay order for a pack (amount fixed here)
//   2. the page opens Razorpay Checkout for that order; the customer pays
//   3. POST /v1/billing/verify  the page sends the payment's signature; the Worker checks it and adds credits
//   4. POST /v1/billing/webhook Razorpay confirms the payment server-to-server (order.paid / payment.captured),
//                               which adds the credits too if step 3 never arrived (closed tab, lost network)
// Steps 3 and 4 both end in creditOrder, which adds an order's credits exactly once.
// Secrets (wrangler secret put): RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET. RAZORPAY_KEY_ID is public.

export interface BillingEnv extends AccountsEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
}

export interface Pack {
  id: string;
  name: string;
  rupees: number;
  chars: number;
}

// ₹5 per 10,000 characters, with 10% and 20% bonuses on the bigger packs (docs/TRANSLATION_API_PLAN.md).
export const CHARS_PER_RUPEE = 2_000;

export const PACKS: Pack[] = [
  { id: "starter", name: "Starter", rupees: 500, chars: 1_000_000 },
  { id: "growth", name: "Growth", rupees: 2_000, chars: 4_400_000 },
  { id: "scale", name: "Scale", rupees: 5_000, chars: 12_000_000 },
];

// Replaced in tests.
export const razorpayApi = {
  fetch: (input: string, init: RequestInit): Promise<Response> => fetch(input, init),
};

function keys(env: BillingEnv): { keyId: string; keySecret: string } {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.DB) throw new ApiError(503, "Payments are not set up yet. Please try again later.");
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

export function packList(env: BillingEnv) {
  return {
    currency: "INR",
    razorpayKeyId: env.RAZORPAY_KEY_ID ?? null,
    payments: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.DB),
    charsPerRupee: CHARS_PER_RUPEE,
    packs: PACKS,
  };
}

export async function createOrder(env: BillingEnv, account: Account, body: { pack?: unknown }, now = Date.now()) {
  const { keyId, keySecret } = keys(env);
  const pack = PACKS.find((p) => p.id === body.pack);
  if (!pack) throw new ApiError(400, `Unknown pack. Choose one of: ${PACKS.map((p) => p.id).join(", ")}.`);

  const amount = pack.rupees * 100;
  const response = await razorpayApi.fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(`${keyId}:${keySecret}`) },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `${account.id}:${now}`.slice(0, 40),
      notes: { account_id: account.id, pack: pack.id, chars: String(pack.chars) },
    }),
  });
  const order = (await response.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
  if (!response.ok || typeof order.id !== "string") {
    console.error("razorpay order failed", response.status, order.error?.description);
    throw new ApiError(502, "Could not start the payment. Please try again.");
  }

  await env.DB!.prepare("INSERT INTO orders (id, account_id, pack, amount_paise, chars, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(order.id, account.id, pack.id, amount, pack.chars, new Date(now).toISOString()).run();

  return {
    orderId: order.id,
    amount,
    currency: "INR",
    keyId,
    pack,
    // Prefill for Razorpay Checkout.
    email: account.email,
    name: account.name,
  };
}

// ---- Signatures ----

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Checkout's handler signature: HMAC-SHA256(order_id + "|" + payment_id, key secret).
export const paymentSignature = (keySecret: string, orderId: string, paymentId: string) => hmacHex(keySecret, `${orderId}|${paymentId}`);

// Webhook signature: HMAC-SHA256(raw body, webhook secret), in X-Razorpay-Signature.
export const webhookSignature = (webhookSecret: string, body: string) => hmacHex(webhookSecret, body);

// ---- Crediting ----

// Adds an order's credits to its account if they were not added yet. Both statements run in one
// D1 transaction and only act while paid = 0, so a repeated call (verify and webhook, retries) adds nothing.
export async function creditOrder(env: BillingEnv, orderId: string, paymentId: string, now = Date.now()): Promise<boolean> {
  const [credit] = await env.DB!.batch([
    env.DB!.prepare("UPDATE accounts SET credits = credits + (SELECT chars FROM orders WHERE id = ?1 AND paid = 0) WHERE id = (SELECT account_id FROM orders WHERE id = ?1 AND paid = 0)")
      .bind(orderId),
    env.DB!.prepare("UPDATE orders SET paid = 1, payment_id = ?2, paid_at = ?3 WHERE id = ?1 AND paid = 0")
      .bind(orderId, paymentId, new Date(now).toISOString()),
  ]);
  return credit.meta.changes > 0;
}

export async function verifyPayment(env: BillingEnv, account: Account, body: Record<string, unknown>, now = Date.now()) {
  const { keySecret } = keys(env);
  const orderId = String(body.razorpay_order_id ?? "");
  const paymentId = String(body.razorpay_payment_id ?? "");
  const signature = String(body.razorpay_signature ?? "");
  if (!orderId || !paymentId || !signature) throw new ApiError(400, "Missing razorpay_order_id, razorpay_payment_id or razorpay_signature.");

  const order = await env.DB!.prepare("SELECT account_id FROM orders WHERE id = ?").bind(orderId).first<{ account_id: string }>();
  if (!order || order.account_id !== account.id) throw new ApiError(404, "Order not found for this API key.");
  if (!sameText(await paymentSignature(keySecret, orderId, paymentId), signature)) {
    throw new ApiError(400, "The payment could not be verified. If money was taken, it will be added automatically or refunded; write to naveen@codegres.com.");
  }
  await creditOrder(env, orderId, paymentId, now);
  return summary(env, account.id);
}

// Razorpay webhook. Returns the HTTP status to answer with: 2xx tells Razorpay not to retry.
export async function handleWebhook(env: BillingEnv, rawBody: string, signature: string | null, now = Date.now()): Promise<number> {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !env.DB) return 503;
  if (!signature || !sameText(await webhookSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature)) return 400;

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return 400;
  }
  if (event?.event !== "order.paid" && event?.event !== "payment.captured") return 200; // not ours to handle

  const payment = event.payload?.payment?.entity;
  const orderId: unknown = event.payload?.order?.entity?.id ?? payment?.order_id;
  const paymentId: unknown = payment?.id;
  if (typeof orderId !== "string" || typeof paymentId !== "string") return 200;

  const order = await env.DB.prepare("SELECT amount_paise FROM orders WHERE id = ?").bind(orderId).first<{ amount_paise: number }>();
  if (!order) return 200; // an order this Worker did not create (e.g. sponsorship)
  if (typeof payment?.amount === "number" && payment.amount < order.amount_paise) {
    console.error("razorpay webhook: payment amount below order amount", orderId);
    return 200;
  }
  await creditOrder(env, orderId, paymentId, now);
  return 200;
}
