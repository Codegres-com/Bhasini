// A D1 stand-in on node:sqlite, with the real migrations applied, so account and billing SQL is
// tested against SQLite (which D1 is) rather than mocked.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1Result, D1Statement } from "../src/accounts.ts";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

export function fakeD1(): D1Database & { sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }

  const statement = (sql: string, values: unknown[] = []): D1Statement & { exec(): D1Result } => {
    const params = values as (string | number | null)[];
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      first: async <T>() => (sqlite.prepare(sql).get(...params) as T | undefined) ?? null,
      all: async <T>() => ({ results: sqlite.prepare(sql).all(...params) as T[] }),
      run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }),
      exec: () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }),
    };
  };

  return {
    sqlite,
    prepare: (sql) => statement(sql),
    // D1 runs a batch as one transaction.
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
