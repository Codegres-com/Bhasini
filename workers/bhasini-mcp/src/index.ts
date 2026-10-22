import { ApiError, authenticate, bearerKey, paidTranslate, rotateKey, signup, summary, type Account } from "./accounts.ts";
import { createOrder, handleWebhook, packList, verifyPayment, type BillingEnv } from "./billing.ts";
import { errorResponse, handleMessage, PARSE_ERROR } from "./mcp.ts";
import { freeTranslate, LimitError, UnavailableError } from "./quota.ts";
import type { ToolContext } from "./tools.ts";
import { TranslateError, type TranslateRequest } from "./translate.ts";

export { TranslateQuota } from "./quota.ts";

// Cloudflare Worker serving, at https://mcp.bhasini.com:
//   /mcp                 the Bhasini MCP server
//   /v1/translate        the translation API (bhasini.com, the Windows app, the C# MCP server, API customers)
//   /v1/account/…        API sign-up and the account dashboard (bhasini.com/api/)
//   /v1/billing/…        prepaid credits through Razorpay
// Static pages stay on GitHub Pages (bhasini.com).

// Free translation settings are described in quota.ts, accounts in accounts.ts, payments in billing.ts.
export interface Env extends BillingEnv {
  // Workers Rate Limiting binding (wrangler.toml); absent in tests.
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  // OpenAI plugin domain verification token (wrangler.toml [vars]); public by design.
  OPENAI_APPS_CHALLENGE?: string;
}

const DOCS_URL = "https://bhasini.com/mcp/";
const MAX_BODY = 64 * 1024;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version, Retry-After",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS, ...headers },
  });
}

function empty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...CORS, ...headers } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // OpenAI domain verification: exactly the token, as plain text, nothing else.
    if (path === "/.well-known/openai-apps-challenge") {
      if (!env.OPENAI_APPS_CHALLENGE || request.method !== "GET") return json({ error: "Not found" }, 404);
      return new Response(env.OPENAI_APPS_CHALLENGE, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    if (path === "/" || path === "/health") {
      if (path === "/health") return json({ status: "ok" });
      return Response.redirect(DOCS_URL, 302);
    }
    if (path.startsWith("/v1/")) return apiRoute(path, request, env);
    if (path !== "/mcp") return json({ error: "Not found. The MCP endpoint is /mcp." }, 404);

    if (request.method === "OPTIONS") return empty(204);

    if (request.method === "GET") {
      // A browser opening the endpoint gets the docs; MCP clients asking for an SSE stream are told
      // this server has none (allowed by the Streamable HTTP spec).
      if ((request.headers.get("Accept") ?? "").includes("text/html")) return Response.redirect(DOCS_URL, 302);
      return empty(405, { Allow: "POST, OPTIONS" });
    }
    if (request.method === "DELETE") return empty(405, { Allow: "POST, OPTIONS" });
    if (request.method !== "POST") return empty(405, { Allow: "POST, OPTIONS" });

    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp(request) });
      if (!success) return json(errorResponse(null, -32000, "Rate limit exceeded. Try again in a minute."), 429, { "Retry-After": "60" });
    }

    const length = Number(request.headers.get("Content-Length") ?? "0");
    if (length > MAX_BODY) return json(errorResponse(null, -32600, "Request too large"), 413);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(errorResponse(null, -32600, "Request too large"), 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(errorResponse(null, PARSE_ERROR, "Parse error"), 400);
    }

    // Batches were removed in protocol 2025-06-18; older clients may still send them.
    if (Array.isArray(body)) {
      if (body.length === 0) return json(errorResponse(null, -32600, "Empty batch"), 400);
      // One at a time, so each translate call in a batch is counted against the limits in turn.
      const ctx = toolContext(env, request);
      const responses: object[] = [];
      for (const message of body) {
        const response = await handleMessage(message, ctx);
        if (response !== undefined) responses.push(response);
      }
      return responses.length > 0 ? json(responses) : empty(202);
    }

    const response = await handleMessage(body, toolContext(env, request));
    return response === undefined ? empty(202) : json(response);
  },
};

const clientIp = (request: Request): string => request.headers.get("CF-Connecting-IP") ?? "unknown";

// With an API key, translation is charged to the account; without one, the free limits apply.
function translateFor(env: Env, request: Request): (req: TranslateRequest) => Promise<unknown> {
  let key: string | undefined;
  try {
    key = bearerKey(request);
  } catch (e) {
    return () => Promise.reject(e);
  }
  return key ? (req) => paidTranslate(env, key, req) : (req) => freeTranslate(env, clientIp(request), req);
}

// The MCP translate tool goes through the same limits (or the same account) as /v1/translate.
const toolContext = (env: Env, request: Request): ToolContext => ({
  translate: translateFor(env, request) as ToolContext["translate"],
});

async function requireAccount(env: Env, request: Request): Promise<Account> {
  const key = bearerKey(request);
  if (!key) throw new ApiError(401, "Sign in with your API key (header 'Authorization: Bearer <key>').");
  return authenticate(env, key);
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new ApiError(413, "Request too large");
  let body: unknown;
  try {
    body = raw === "" ? {} : JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new ApiError(400, "Body must be a JSON object.");
  return body as Record<string, unknown>;
}

type Handler = (request: Request, env: Env) => Promise<unknown>;

const ROUTES: Record<string, { method: "GET" | "POST"; handler: Handler }> = {
  // {"text", "source"?, "target"} → {"translation", "source", "target", "characters", "models",
  //   "freeCharsLeftToday" (free) | "creditsLeft" (API key)}
  "/v1/translate": {
    method: "POST",
    handler: async (request, env) => {
      const translateText = translateFor(env, request);
      const { text, source, target } = await jsonBody(request);
      return translateText({ text, source, target });
    },
  },
  // {"email", "name"?} → {"apiKey", "account"}; the key is shown only here.
  "/v1/account/signup": { method: "POST", handler: async (request, env) => signup(env, clientIp(request), await jsonBody(request)) },
  "/v1/account": { method: "GET", handler: async (request, env) => summary(env, (await requireAccount(env, request)).id) },
  "/v1/account/rotate-key": { method: "POST", handler: async (request, env) => rotateKey(env, await requireAccount(env, request)) },
  "/v1/billing/packs": { method: "GET", handler: async (_request, env) => packList(env) },
  "/v1/billing/order": {
    method: "POST",
    handler: async (request, env) => {
      const account = await requireAccount(env, request);
      return createOrder(env, account, await jsonBody(request));
    },
  },
  "/v1/billing/verify": {
    method: "POST",
    handler: async (request, env) => {
      const account = await requireAccount(env, request);
      return verifyPayment(env, account, await jsonBody(request));
    },
  },
};

async function apiRoute(path: string, request: Request, env: Env): Promise<Response> {
  // Razorpay calls this server-to-server with a signed raw body; no CORS, no JSON parsing first.
  if (path === "/v1/billing/webhook") {
    if (request.method !== "POST") return json({ error: "Not found" }, 404);
    const status = await handleWebhook(env, await request.text(), request.headers.get("X-Razorpay-Signature"));
    return json({ ok: status < 300 }, status);
  }

  const route = ROUTES[path];
  if (!route) return json({ error: "Not found." }, 404);
  if (request.method === "OPTIONS") return empty(204);
  if (request.method !== route.method) return json({ error: `Use ${route.method}.` }, 405, { Allow: `${route.method}, OPTIONS` });

  try {
    return json(await route.handler(request, env));
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status, e.headers);
    if (e instanceof TranslateError) return json({ error: e.message }, 400);
    if (e instanceof LimitError) return json({ error: e.message }, 429, { "Retry-After": String(e.retryAfterSeconds) });
    if (e instanceof UnavailableError) return json({ error: e.message }, 503);
    console.error(`${path} failed`, e);
    return json({ error: path === "/v1/translate" ? "Translation failed. Please try again." : "Something went wrong. Please try again." }, 502);
  }
}
