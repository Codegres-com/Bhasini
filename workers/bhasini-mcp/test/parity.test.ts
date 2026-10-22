// The TypeScript port must give exactly the C# engine's output. test/fixtures.json is exported from
// C# by tools/Bhasini.FixtureGen (`npm run fixtures`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOOL_DEFINITIONS, convert, getKeymap, listLanguages, nativeDigits, transliterate } from "../src/tools.ts";

interface Case {
  lang?: string;
  target?: string;
  input: string;
  output: string;
}

const fixtures = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) as {
  languages: unknown[];
  keymaps: Record<string, unknown>;
  transliterate: Case[];
  convert: Case[];
  digits: Case[];
};

// Compares as JSON, the form both servers send to the model.
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

function expectAll(cases: Case[], run: (c: Case) => string) {
  const failures = cases
    .map((c) => ({ ...c, actual: run(c) }))
    .filter((c) => c.actual !== c.output);
  assert.deepEqual(failures.slice(0, 20), [], `${failures.length} of ${cases.length} cases differ from C#`);
}

test("list_languages matches C#", () => {
  assert.deepEqual(asJson(listLanguages()), fixtures.languages);
});

test("get_keymap matches C# for every language", () => {
  for (const [code, expected] of Object.entries(fixtures.keymaps)) {
    assert.deepEqual(asJson(getKeymap({ language: code })), expected, code);
  }
});

test("transliterate matches C#", () => {
  expectAll(fixtures.transliterate, (c) => transliterate({ text: c.input, language: c.lang }));
});

test("convert_script matches C#", () => {
  expectAll(fixtures.convert, (c) => convert({ text: c.input, targetLanguage: c.target }));
});

test("native_digits matches C#", () => {
  expectAll(fixtures.digits, (c) => nativeDigits({ text: c.input, language: c.lang }));
});

test("tool definitions are the ones exported from C#", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name).sort();
  assert.deepEqual(names, ["convert_script", "get_keymap", "list_languages", "native_digits", "translate", "transliterate"]);
  for (const t of TOOL_DEFINITIONS) {
    assert.equal(t.annotations.readOnlyHint, true, t.name);
    assert.equal(t.annotations.destructiveHint, false, t.name);
    assert.ok(t.title, t.name);
    // Only translate leaves the machine.
    assert.equal(t.annotations.openWorldHint, t.name === "translate", t.name);
  }
});
