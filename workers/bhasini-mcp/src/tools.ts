import { findLanguage, LANGUAGES, sample, supportsInscript, type IndicLanguage } from "./engine/catalog.ts";
import { canConvertTo, convertScript, fromRoman } from "./engine/convert.ts";
import definitions from "./generated/tools.json" with { type: "json" };
import { ApiError } from "./accounts.ts";
import { LimitError, UnavailableError } from "./quota.ts";
import { TranslateError, type TranslateRequest, type TranslateResult } from "./translate.ts";

// The same tools as src/Bhasini.Mcp/IndicTools.cs. Names, descriptions, input schemas and
// annotations come from generated/tools.json, which tools/Bhasini.FixtureGen exports from the C#
// server, so both servers always list identical tools.

export const TOOL_DEFINITIONS = definitions;

// A tool failure that is reported to the model as an error result (C# McpException).
export class ToolError extends Error {}

// What a tool may need from the Worker. Only translate uses it: the Worker passes a function that
// already applies the free limits for the caller's IP (quota.ts).
export interface ToolContext {
  translate?: (request: TranslateRequest) => Promise<TranslateResult>;
}

const MAX_TEXT = 20_000;

function find(language: unknown): IndicLanguage {
  const key = String(language ?? "");
  const match = findLanguage(key);
  if (!match) throw new ToolError(`Unknown language '${key}'. Call list_languages for the supported codes.`);
  return match;
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new ToolError("'text' must be a string.");
  if (value.length > MAX_TEXT) throw new ToolError(`'text' is longer than ${MAX_TEXT} characters. Split it into smaller pieces.`);
  return value;
}

export function listLanguages() {
  return LANGUAGES.map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
    script: l.scriptName,
    rightToLeft: l.rightToLeft,
    inScript: supportsInscript(l),
    scriptConversionTarget: canConvertTo(l),
    example: `${l.sampleInput} → ${sample(l)}`,
  }));
}

export function transliterate(args: Record<string, unknown>): string {
  const input = text(args.text);
  return fromRoman(input, find(args.language));
}

export function convert(args: Record<string, unknown>): string {
  const input = text(args.text);
  const target = find(args.targetLanguage);
  if (!canConvertTo(target)) {
    throw new ToolError(`${target.name} (${target.scriptName}) is not a script conversion target. Use transliterate with romanised text instead.`);
  }
  return convertScript(input, target);
}

export function getKeymap(args: Record<string, unknown>) {
  return find(args.language).phonetic.keymap;
}

export function nativeDigits(args: Record<string, unknown>): string {
  const input = text(args.text);
  const target = find(args.language);
  if (!target.digit) throw new ToolError(`${target.name} has no native digits.`);
  const digit = target.digit;
  return input.replace(/[0-9]/g, (d) => digit(d.charCodeAt(0) - 48));
}

// The C# server forwards translate to https://mcp.bhasini.com/v1/translate; here it runs in place.
export async function translateTool(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  if (!ctx.translate) throw new ToolError("Translation is not available on this server.");
  const result = await ctx.translate({ text: args.text, source: args.sourceLanguage, target: args.targetLanguage });
  return result.translation;
}

const HANDLERS: Record<string, (args: Record<string, unknown>, ctx: ToolContext) => unknown> = {
  list_languages: () => listLanguages(),
  transliterate,
  convert_script: convert,
  get_keymap: getKeymap,
  native_digits: nativeDigits,
  translate: translateTool,
};

export const hasTool = (name: string): boolean => Object.hasOwn(HANDLERS, name);

// Runs a tool and returns MCP CallToolResult content, the way the C# SDK formats it:
// strings as-is, anything else as compact JSON, failures as isError results.
export async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext = {}) {
  try {
    const value = await HANDLERS[name](args, ctx);
    return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] };
  } catch (e) {
    if (!(e instanceof ToolError || e instanceof TranslateError || e instanceof LimitError || e instanceof UnavailableError || e instanceof ApiError)) throw e;
    return { content: [{ type: "text", text: `An error occurred invoking '${name}': ${e.message}` }], isError: true };
  }
}
