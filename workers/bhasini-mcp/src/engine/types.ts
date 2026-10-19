// TypeScript port of src/Bhasini.Core (the C# engine is the reference implementation).
// Strings are processed as UTF-16 code units, like C# chars, so both give identical output;
// test/parity.test.ts checks that against fixtures exported from C#.

export interface KeymapEntry {
  keys: string;
  output: string;
  note?: string;
}

export interface KeymapGroup {
  title: string;
  entries: KeymapEntry[];
}

// Turns the Latin keys of one word into text in a language's script.
export interface Transliterator {
  isWordChar(c: string): boolean;
  render(latinWord: string): string;
  readonly keymap: KeymapGroup[];
}

// Converts text in "Devanagari space" into a script and back.
export interface ScriptMapper {
  // phonetic = true applies the script's spelling rules for typed words (chillus, tippi, ya-shruti).
  fromDevanagari(deva: string, phonetic: boolean): string;
  toDevanagari(text: string): string;
  owns(c: string): boolean;
  nativeDigit(digit: number): string;
}

export function isUpper(c: string): boolean {
  return c !== c.toLowerCase();
}
