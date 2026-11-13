import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import postgres from "postgres";

/**
 * A local stand-in for Neon's SQL-over-HTTP endpoint, backed by an ordinary Postgres.
 *
 * `@neondatabase/serverless` POSTs `{ query, params }` to `<fetchEndpoint>` and expects
 * `{ fields, rows, command, rowCount }` with raw text values. Pointing
 * `neonConfig.fetchEndpoint` here lets the test suite run the REAL neon-http driver —
 * same statements, same parameter and result handling as against Neon — without network
 * access. It is a test double for the transport only; it never runs in the app.
 */
export async function startNeonHttpProxy(databaseUrl: string): Promise<{ url: string; statements: () => number; close: () => Promise<void> }> {
  const sql = postgres(databaseUrl, { prepare: false, max: 2, onnotice: () => {}, fetch_types: false });
  // Neon passes every parameter as text and lets the server cast it. postgres.js would
  // JSON-encode strings bound to json/jsonb parameters a second time; send them as they are.
  const options = sql.options as unknown as { serializers: Record<number, (value: unknown) => unknown> };
  for (const oid of [114, 3802]) options.serializers[oid] = (value) => value;
  let statements = 0;

  async function run(query: string, params: unknown[], arrayMode: boolean) {
    statements += 1;
    const result = await sql.unsafe(query, params as never[]).raw();
    const columns = (result as unknown as { columns?: Array<{ name: string; type: number }> }).columns ?? [];
    const rows = (result as unknown as Array<Array<Buffer | null>>).map((row) => row.map((value) => (value === null ? null : value.toString("utf8"))));
    return {
      command: (result as unknown as { command: string }).command,
      rowCount: (result as unknown as { count: number }).count,
      fields: columns.map((column) => ({ name: column.name, dataTypeID: column.type, tableID: 0, columnID: 0, dataTypeSize: -1, dataTypeModifier: -1, format: "text" })),
      rows: arrayMode ? rows : rows.map((row) => Object.fromEntries(row.map((value, index) => [columns[index]!.name, value]))),
      rowAsArray: arrayMode,
    };
  }

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { query?: string; params?: unknown[]; queries?: Array<{ query: string; params?: unknown[] }> };
        const arrayMode = request.headers["neon-array-mode"] === "true";
        const payload = body.queries
          ? { results: await Promise.all(body.queries.map((entry) => run(entry.query, entry.params ?? [], arrayMode))) }
          : await run(body.query ?? "", body.params ?? [], arrayMode);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(payload));
      } catch (error) {
        const failure = error as { message?: string; code?: string };
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: failure.message ?? "query failed", code: failure.code }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/sql`,
    statements: () => statements,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await sql.end({ timeout: 5 });
    },
  };
}
