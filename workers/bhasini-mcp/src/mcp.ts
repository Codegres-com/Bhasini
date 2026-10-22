import { callTool, hasTool, TOOL_DEFINITIONS, type ToolContext } from "./tools.ts";

// A stateless MCP server over the Streamable HTTP transport (JSON responses, no sessions, no SSE).
// Every tool is a function of its arguments (translate also calls Workers AI), so there is nothing
// to keep between requests.

export const SERVER_VERSION = "0.1.0";
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Exact, rule-based tools for the 22 scheduled languages of India. Use transliterate to write romanised words " +
  "in a native script by sound (not translation), convert_script to move text between Indian scripts, get_keymap " +
  "to find the keys for a letter, native_digits for numerals and list_languages for codes. Prefer these tools to " +
  "writing Indic letters from memory when exact spelling matters. translate translates meaning between English and " +
  "these languages (AI4Bharat IndicTrans2); it is the one tool that sends text to a server.";

type Id = string | number | null;

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: Id;
  method?: unknown;
  params?: unknown;
}

export const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

export function errorResponse(id: Id, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function result(id: Id, value: unknown) {
  return { jsonrpc: "2.0", id, result: value };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Handles one JSON-RPC message. Returns the response, or undefined for notifications and responses.
export async function handleMessage(message: unknown, ctx: ToolContext = {}): Promise<object | undefined> {
  if (!isObject(message) || message.jsonrpc !== "2.0") {
    return errorResponse(isObject(message) ? ((message as JsonRpcMessage).id ?? null) : null, INVALID_REQUEST, "Invalid JSON-RPC message");
  }
  const { id, method, params } = message as JsonRpcMessage;

  // A response or a notification from the client: nothing to send back.
  if (method === undefined || id === undefined) return undefined;
  if (typeof method !== "string") return errorResponse(id, INVALID_REQUEST, "method must be a string");

  try {
    switch (method) {
      case "initialize": {
        const requested = isObject(params) ? params.protocolVersion : undefined;
        const protocolVersion = typeof requested === "string" && PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
        return result(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "bhasini",
            title: "Bhasini Indic Languages",
            version: SERVER_VERSION,
            websiteUrl: "https://bhasini.com/mcp/",
          },
          instructions: INSTRUCTIONS,
        });
      }

      case "ping":
        return result(id, {});

      case "tools/list":
        return result(id, { tools: TOOL_DEFINITIONS });

      case "tools/call": {
        if (!isObject(params) || typeof params.name !== "string") return errorResponse(id, INVALID_PARAMS, "tools/call needs a tool name");
        if (!hasTool(params.name)) return errorResponse(id, INVALID_PARAMS, `Unknown tool: ${params.name}`);
        const args = isObject(params.arguments) ? params.arguments : {};
        return result(id, await callTool(params.name, args, ctx));
      }

      // Empty lists so clients that probe these don't see errors.
      case "resources/list":
        return result(id, { resources: [] });
      case "resources/templates/list":
        return result(id, { resourceTemplates: [] });
      case "prompts/list":
        return result(id, { prompts: [] });

      default:
        return errorResponse(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (e) {
    return errorResponse(id, INTERNAL_ERROR, e instanceof Error ? e.message : "Internal error");
  }
}
