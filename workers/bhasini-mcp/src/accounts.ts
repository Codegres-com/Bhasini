import { istDay, type FreeEnv } from "./quota.ts";
import { MAX_TRANSLATE_CHARS, translate, type TranslateRequest, type TranslateResult } from "./translate.ts";

// Translation API accounts. An account is an email address, one API key and a balance of prepaid
// characters ("credits"). The API key is the login: there are no passwords. Only a SHA-256 hash of
// the key is stored, so a lost key cannot be shown again, only replaced (rotateKey).
// Requests with `Authorization: Bearer bk_live_…` are charged here instead of using the free limits.
// Tables: migrations/0001_accounts.sql. Payments: billing.ts.

// ---- D1 (the parts we use); node:sqlite stands in for it in tests ----

export interface D1Result {
  meta: { changes: number };
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AccountsEnv extends FreeEnv {
  DB?: D1Database;
  // Paid requests per minute per account (wrangler.toml [[ratelimits]]).
  KEY_LIMITER?: RateLimiter;
  // Sign-up attempts per minute per IP.
  SIGNUP_LIMITER?: RateLimiter;
  // Free characters a new account starts with (wrangler.toml [vars]).
  SIGNUP_FREE_CHARS?: string;
}

// A request that fails with an HTTP status: the REST API returns it, MCP reports an isError result.
export class ApiError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export const DEFAULT_SIGNUP_FREE_CHARS = 10_000;
export const MAX_SIGNUPS_PER_IP_PER_DAY = 3;
export const PAID_RATE_LIMIT_PER_MINUTE = 300;

export interface Account {
  id: string;
  email: string;
  name: string | null;
  key_prefix: string;
  credits: number;
  created_at: string;
}

const KEY_PREFIX = "bk_live_";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number): string {
  // 62 * 4 = 248 < 256: reject bytes >= 248 so every character is equally likely.
  let out = "";
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < 248 && out.length < length) out += ALPHABET[b % 62];
    }
  }
  return out;
}

export const newApiKey = (): string => KEY_PREFIX + randomString(32);

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const looksLikeApiKey = (value: string): boolean => /^bk_live_[A-Za-z0-9]{32}$/.test(value);

// The key from `Authorization: Bearer …`, or undefined when there is none (free use).
export function bearerKey(request: Request): string | undefined {
  const header = request.headers.get("Authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) throw new ApiError(401, "Use the header 'Authorization: Bearer <your API key>'.");
  return match[1];
}

function db(env: AccountsEnv): D1Database {
  if (!env.DB) throw new ApiError(503, "API accounts are not available right now.");
  return env.DB;
}

const ACCOUNT_COLUMNS = "id, email, name, key_prefix, credits, created_at";

export async function authenticate(env: AccountsEnv, apiKey: string): Promise<Account> {
  const invalid = new ApiError(401, "Invalid API key. Check it, or get a new one at https://bhasini.com/api/.");
  if (!looksLikeApiKey(apiKey)) throw invalid;
  const account = await db(env).prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE key_hash = ?`)
    .bind(await sha256Hex(apiKey)).first<Account>();
  if (!account) throw invalid;
  return account;
}

// ---- Sign-up and key management ----

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(env: AccountsEnv, ip: string, body: { email?: unknown; name?: unknown }, now = Date.now()) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!EMAIL.test(email) || email.length > 254) throw new ApiError(400, "Enter a valid email address.");

  if (env.SIGNUP_LIMITER && !(await env.SIGNUP_LIMITER.limit({ key: ip })).success) {
    throw new ApiError(429, "Too many sign-ups. Try again in a minute.", { "Retry-After": "60" });
  }
  const database = db(env);
  const ipHash = await sha256Hex(`bhasini-signup:${ip}`);
  const { day, ends } = istDay(now);
  const dayStart = new Date(ends - 24 * 60 * 60 * 1000).toISOString();
  const recent = await database.prepare("SELECT COUNT(*) AS n FROM accounts WHERE signup_ip_hash = ? AND created_at >= ?")
    .bind(ipHash, dayStart).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_SIGNUPS_PER_IP_PER_DAY) {
    throw new ApiError(429, `At most ${MAX_SIGNUPS_PER_IP_PER_DAY} new accounts a day from one network (${day}). Write to naveen@codegres.com if you need more.`);
  }
  const existing = await database.prepare("SELECT id FROM accounts WHERE email = ?").bind(email).first();
  if (existing) {
    throw new ApiError(409, "This email already has an API key. Sign in with it, or write to naveen@codegres.com if you lost it.");
  }

  const apiKey = newApiKey();
  const id = "acct_" + randomString(16);
  const credits = Number(env.SIGNUP_FREE_CHARS ?? DEFAULT_SIGNUP_FREE_CHARS) || 0;
  await database.prepare(
    "INSERT INTO accounts (id, email, name, key_hash, key_prefix, credits, created_at, signup_ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, email, name || null, await sha256Hex(apiKey), apiKey.slice(0, 12), credits, new Date(now).toISOString(), ipHash)
    .run();
  return { apiKey, account: await summary(env, id) };
}

export async function rotateKey(env: AccountsEnv, account: Account) {
  const apiKey = newApiKey();
  await db(env).prepare("UPDATE accounts SET key_hash = ?, key_prefix = ? WHERE id = ?")
    .bind(await sha256Hex(apiKey), apiKey.slice(0, 12), account.id).run();
  return { apiKey, account: await summary(env, account.id) };
}

// What the dashboard shows: balance, the last 30 days of usage and the payments.
export async function summary(env: AccountsEnv, accountId: string) {
  const database = db(env);
  const account = await database.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = ?`).bind(accountId).first<Account>();
  if (!account) throw new ApiError(404, "Account not found.");
  const usage = await database.prepare("SELECT day, chars, requests FROM usage_daily WHERE account_id = ? ORDER BY day DESC LIMIT 30")
    .bind(accountId).all<{ day: string; chars: number; requests: number }>();
  const payments = await database.prepare(
    "SELECT id AS orderId, payment_id AS paymentId, pack, amount_paise AS amountPaise, chars, paid_at AS paidAt FROM orders WHERE account_id = ? AND paid = 1 ORDER BY paid_at DESC LIMIT 50")
    .bind(accountId).all();
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    keyPrefix: account.key_prefix,
    credits: account.credits,
    createdAt: account.created_at,
    usage: usage.results,
    payments: payments.results,
  };
}

// ---- Paid translation ----

export interface PaidResult extends TranslateResult {
  creditsLeft: number;
}

export async function paidTranslate(env: AccountsEnv, apiKey: string, request: TranslateRequest, now = Date.now()): Promise<PaidResult> {
  const ai = env.TRANSLATE_ENABLED === "false" ? undefined : env.AI;
  if (!ai) throw new ApiError(503, "Translation is temporarily unavailable.");
  const account = await authenticate(env, apiKey);

  if (typeof request.text !== "string") throw new ApiError(400, "'text' must be a string.");
  const chars = [...request.text].length;
  if (chars > MAX_TRANSLATE_CHARS) {
    throw new ApiError(400, `'text' is longer than ${MAX_TRANSLATE_CHARS.toLocaleString("en-IN")} characters. Split it into smaller pieces.`);
  }
  if (env.KEY_LIMITER && !(await env.KEY_LIMITER.limit({ key: account.id })).success) {
    throw new ApiError(429, `This API key is limited to ${PAID_RATE_LIMIT_PER_MINUTE} requests a minute. Slow down, or write to naveen@codegres.com for more.`, { "Retry-After": "60" });
  }

  // Take the characters first (atomically, never below zero) and give them back if nothing was translated.
  const database = db(env);
  const charged = await database.prepare("UPDATE accounts SET credits = credits - ? WHERE id = ? AND credits >= ? RETURNING credits")
    .bind(chars, account.id, chars).first<{ credits: number }>();
  if (!charged) {
    throw new ApiError(402, `Not enough credits: ${account.credits.toLocaleString("en-IN")} characters left, this text needs ${chars.toLocaleString("en-IN")}. Buy more at https://bhasini.com/api/.`);
  }
  const refund = () => database.prepare("UPDATE accounts SET credits = credits + ? WHERE id = ?").bind(chars, account.id).run();

  let result: TranslateResult;
  try {
    result = await translate(ai, request);
  } catch (e) {
    await refund();
    throw e;
  }
  if (result.models.length === 0) {
    await refund();
    return { ...result, creditsLeft: charged.credits + chars };
  }
  await database.prepare(
    "INSERT INTO usage_daily (account_id, day, chars, requests) VALUES (?, ?, ?, 1) ON CONFLICT (account_id, day) DO UPDATE SET chars = chars + excluded.chars, requests = requests + 1")
    .bind(account.id, istDay(now).day, chars).run();
  return { ...result, creditsLeft: charged.credits };
}
