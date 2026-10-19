import { errorResponse, handleMessage, PARSE_ERROR } from "./mcp.ts";

// Cloudflare Worker serving the Bhasini MCP server at https://mcp.bhasini.com/mcp.
// Static pages stay on GitHub Pages (bhasini.com); this Worker only answers MCP requests.

export interface Env {
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
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
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
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
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
      const responses = body.map(handleMessage).filter((r) => r !== undefined);
      return responses.length > 0 ? json(responses) : empty(202);
    }

    const response = handleMessage(body);
    return response === undefined ? empty(202) : json(response);
  },
};
