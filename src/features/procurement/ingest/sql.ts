import { getTableColumns, getTableName, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * Driver-agnostic SQL helpers for ingestion.
 *
 * Everything here goes through `db.execute(sql)` with single statements — no interactive
 * transactions — so the same code runs on drizzle's postgres-js driver (app, local seed)
 * and on neon-http (seeding a remote Neon database over HTTPS).
 */
export type SqlExecutor = { execute: (query: SQL) => Promise<unknown> };

/** postgres-js returns an array of rows, neon-http an object with `rows`. */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export async function queryRows<T = Record<string, unknown>>(db: SqlExecutor, query: SQL): Promise<T[]> {
  return rowsOf<T>(await db.execute(query));
}

/** JSON text safe for a jsonb parameter (PostgreSQL rejects \u0000 inside jsonb strings). */
export function jsonParam(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

/** A text[] value built from one JSON parameter — works identically on every driver. */
export function textArrayParam(values: readonly string[]): SQL {
  return sql`array(select jsonb_array_elements_text(${jsonParam(values)}::jsonb))`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export type BulkUpsertOptions<Row> = {
  /** Properties of the row objects to write (TS names of the table's columns). */
  columns: Array<keyof Row & string>;
  /** Conflict target (TS names). */
  conflict: Array<keyof Row & string>;
  /** Columns overwritten on conflict. Default: every written column outside the conflict target. `[]` with no `setRaw` = DO NOTHING. */
  update?: Array<keyof Row & string>;
  /** Extra raw assignments; `t` is the existing row, `excluded` the incoming one. */
  setRaw?: string[];
  /** Raw condition for DO UPDATE (same aliases). */
  where?: string;
  chunkSize?: number;
};

/**
 * INSERT … SELECT FROM jsonb_to_recordset($1) ON CONFLICT … — one statement and one
 * parameter per chunk, whatever the number of rows. Column SQL types come from the Drizzle
 * table definition, so arrays, numerics, timestamps and jsonb round-trip without per-table code.
 */
export async function bulkUpsert<Row extends Record<string, unknown>>(
  db: SqlExecutor,
  table: PgTable,
  rows: readonly Row[],
  options: BulkUpsertOptions<Row>,
): Promise<void> {
  if (rows.length === 0) return;
  const all = getTableColumns(table) as Record<string, PgColumn>;
  const columns = options.columns.map((key) => {
    const column = all[key];
    if (!column) throw new Error(`bulkUpsert: ${getTableName(table)} has no column "${key}"`);
    return { key, name: column.name, type: column.getSQLType() };
  });
  const nameOf = (key: string) => {
    const column = all[key];
    if (!column) throw new Error(`bulkUpsert: ${getTableName(table)} has no column "${key}"`);
    return column.name;
  };
  const conflictNames = options.conflict.map(nameOf);
  const updateKeys = options.update ?? options.columns.filter((key) => !options.conflict.includes(key));
  const assignments = [...updateKeys.map((key) => `${quote(nameOf(key))} = excluded.${quote(nameOf(key))}`), ...(options.setRaw ?? [])];

  const head =
    `insert into ${quote(getTableName(table))} as t (${columns.map((column) => quote(column.name)).join(", ")}) ` +
    `select ${columns.map((column) => `x.${quote(column.name)}`).join(", ")} from jsonb_to_recordset(`;
  const tail =
    `::jsonb) as x(${columns.map((column) => `${quote(column.name)} ${column.type}`).join(", ")}) ` +
    `on conflict (${conflictNames.map(quote).join(", ")}) ` +
    (assignments.length > 0 ? `do update set ${assignments.join(", ")}${options.where ? ` where ${options.where}` : ""}` : "do nothing");

  for (const part of chunk(rows, options.chunkSize ?? 1000)) {
    const payload = part.map((row) => {
      const out: Record<string, unknown> = {};
      for (const column of columns) out[column.name] = row[column.key] ?? null;
      return out;
    });
    await db.execute(sql`${sql.raw(head)}${jsonParam(payload)}${sql.raw(tail)}`);
  }
}

// --- reading raw rows: both drivers hand back strings for numerics and timestamps ----------

export function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function int(value: unknown): number {
  return Math.trunc(num(value) ?? 0);
}

export function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const time = Date.parse(String(value).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function strArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) {
    const inner = value.slice(1, -1);
    return inner ? inner.split(",").map((item) => item.replace(/^"|"$/g, "")) : [];
  }
  return [];
}
