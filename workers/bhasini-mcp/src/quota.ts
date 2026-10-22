import { translate, TranslateError, type Ai, type TranslateRequest, type TranslateResult } from "./translate.ts";

// Free (anonymous) translation limits. Every translation, from /v1/translate or the MCP translate
// tool (single or batched), goes through freeTranslate:
//   1. per request: FREE_MAX_CHARS_PER_REQUEST characters (default 2,000)
//   2. per minute:  TRANSLATE_LIMITER, 5 requests per IP (approximate, per Cloudflare location)
//   3. per day:     FREE_DAILY_CHARS_PER_IP (default 10,000), exact, in a Durable Object per IP
//   4. per day:     FREE_DAILY_CHARS_GLOBAL (default 300,000) across all free users, so the
//                   Workers AI bill for free traffic has a ceiling (see docs/TRANSLATION_API_PLAN.md)
// Days run on India time and reset at midnight IST.

export const DEFAULT_MAX_CHARS_PER_REQUEST = 2_000;
export const DEFAULT_DAILY_CHARS_PER_IP = 10_000;
export const DEFAULT_DAILY_CHARS_GLOBAL = 300_000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Durable Object ----

// The slice of DurableObjectState the counter uses; a fake in tests.
export interface QuotaState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    deleteAll(): Promise<void>;
    setAlarm(scheduledTime: number): Promise<void>;
  };
}

interface QuotaCommand {
  op: "reserve" | "refund";
  chars: number;
  limit?: number;
  expires?: number; // epoch ms when this counter's day is over and it can be deleted
}

export interface QuotaReply {
  ok: boolean;
  used: number;
}

// One counter: characters used today by one IP, or by all free users. Durable Objects run one
// event at a time and hold other events while storage calls are in flight, so the read and the
// write below cannot interleave with another request: the limit is exact.
export class TranslateQuota {
  private readonly state: QuotaState;

  constructor(state: QuotaState, _env?: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const command = (await request.json()) as QuotaCommand;
    const used = (await this.state.storage.get<number>("used")) ?? 0;
    const chars = Math.max(0, Math.floor(command.chars));

    if (command.op === "refund") {
      const next = Math.max(0, used - chars);
      await this.state.storage.put("used", next);
      return Response.json({ ok: true, used: next } satisfies QuotaReply);
    }

    if (used + chars > (command.limit ?? 0)) return Response.json({ ok: false, used } satisfies QuotaReply);
    await this.state.storage.put("used", used + chars);
    // The first reservation of the day schedules the counter's deletion, so nothing outlives its day.
    if (used === 0 && command.expires) await this.state.storage.setAlarm(command.expires);
    return Response.json({ ok: true, used: used + chars } satisfies QuotaReply);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}

// ---- Free tier ----

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface QuotaNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string, init: RequestInit): Promise<Response> };
}

export interface FreeEnv {
  AI?: Ai;
  TRANSLATE_ENABLED?: string;
  TRANSLATE_LIMITER?: RateLimiter;
  TRANSLATE_QUOTA?: QuotaNamespace;
  FREE_MAX_CHARS_PER_REQUEST?: string;
  FREE_DAILY_CHARS_PER_IP?: string;
  FREE_DAILY_CHARS_GLOBAL?: string;
}

// A free limit was hit: 429 on the REST API, an isError result over MCP.
export class LimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Translation is switched off or not configured: 503 on the REST API.
export class UnavailableError extends Error {}

export interface FreeResult extends TranslateResult {
  freeCharsLeftToday: number;
}

const setting = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const maxCharsPerRequest = (env: FreeEnv): number => setting(env.FREE_MAX_CHARS_PER_REQUEST, DEFAULT_MAX_CHARS_PER_REQUEST);

// The current day in India, e.g. "2026-10-22", and when it ends (epoch ms).
export function istDay(now: number): { day: string; ends: number } {
  const ist = now + IST_OFFSET_MS;
  const start = ist - (ist % DAY_MS);
  return { day: new Date(start).toISOString().slice(0, 10), ends: start + DAY_MS - IST_OFFSET_MS };
}

// Counters are keyed by a hash of the IP address, never the address itself.
async function ipKey(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bhasini-translate:${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function counter(ns: QuotaNamespace, name: string, command: QuotaCommand): Promise<QuotaReply> {
  const response = await ns.get(ns.idFromName(name)).fetch("https://quota/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  return (await response.json()) as QuotaReply;
}

const formatted = (n: number): string => n.toLocaleString("en-IN");

export async function freeTranslate(env: FreeEnv, ip: string, request: TranslateRequest, now = Date.now()): Promise<FreeResult> {
  const ai = env.TRANSLATE_ENABLED === "false" ? undefined : env.AI;
  if (!ai) throw new UnavailableError("Translation is temporarily unavailable.");

  if (typeof request.text !== "string") throw new TranslateError("'text' must be a string.");
  const chars = [...request.text].length;
  const maxChars = maxCharsPerRequest(env);
  if (chars > maxChars) {
    throw new TranslateError(`Free translation takes up to ${formatted(maxChars)} characters at a time; this text has ${formatted(chars)}. Split it into smaller pieces.`);
  }

  if (env.TRANSLATE_LIMITER && !(await env.TRANSLATE_LIMITER.limit({ key: ip })).success) {
    throw new LimitError("Free translation allows 5 requests a minute. Try again in a minute.", 60);
  }

  const perIp = setting(env.FREE_DAILY_CHARS_PER_IP, DEFAULT_DAILY_CHARS_PER_IP);
  const global = setting(env.FREE_DAILY_CHARS_GLOBAL, DEFAULT_DAILY_CHARS_GLOBAL);
  const { day, ends } = istDay(now);
  const untilMidnight = Math.max(60, Math.ceil((ends - now) / 1000));
  const ns = env.TRANSLATE_QUOTA;

  // Without the Durable Object binding (tests, misconfiguration) only the per-request and
  // per-minute limits apply.
  let reserved: (() => Promise<void>) | undefined;
  let left = perIp;
  if (ns && chars > 0) {
    const ipName = `ip:${day}:${await ipKey(ip)}`;
    const globalName = `global:${day}`;
    const expires = ends + 60 * 60 * 1000;

    const mine = await counter(ns, ipName, { op: "reserve", chars, limit: perIp, expires });
    if (!mine.ok) {
      const remaining = Math.max(0, perIp - mine.used);
      throw new LimitError(
        `You have used today's free translation allowance (${formatted(perIp)} characters; ${formatted(remaining)} left, this text needs ${formatted(chars)}). It resets at midnight IST, or get an API key for more at https://bhasini.com/api/.`,
        untilMidnight);
    }
    const all = await counter(ns, globalName, { op: "reserve", chars, limit: global, expires });
    if (!all.ok) {
      await counter(ns, ipName, { op: "refund", chars });
      throw new LimitError("Free translation has reached today's limit for all users. Please try again after midnight IST.", untilMidnight);
    }
    left = perIp - mine.used;
    reserved = async () => {
      await Promise.all([counter(ns, ipName, { op: "refund", chars }), counter(ns, globalName, { op: "refund", chars })]);
    };
  }

  // Characters count only when a model ran: failures and no-op requests are given back.
  let result: TranslateResult;
  try {
    result = await translate(ai, request, maxChars);
  } catch (e) {
    await reserved?.();
    throw e;
  }
  if (result.models.length === 0 && reserved) {
    await reserved();
    left += chars;
  }
  return { ...result, freeCharsLeftToday: left };
}
