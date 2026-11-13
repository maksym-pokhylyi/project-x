import type { Metadata } from "next";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getIngestionOverview } from "@/features/procurement/ingest/run";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Data ingestion" };

const when = (iso: string | null) => (iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : "—");

/** Founder view of the Find a Tender ingestion: table sizes, cursors and recent runs. */
export default async function AdminIngestionPage() {
  await requireAdminForPage();
  const overview = await getIngestionOverview();
  const counts: Array<[string, number]> = [
    ["notices", overview.counts.notices],
    ["open tenders", overview.counts.liveTenders],
    ["current awards", overview.counts.awards],
    ["suppliers", overview.counts.suppliers],
    ["buyers", overview.counts.buyers],
  ];
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="type-page text-ink">Data ingestion</h1>
        <p className="text-15 text-ink-2">Find a Tender feed. Newest notice: {when(overview.counts.newestNoticeAt)}.</p>
      </div>

      <StatRow frame="card" aria-label="Table sizes">
        {counts.map(([label, value]) => (
          <Stat key={label} value={value.toLocaleString("en-GB")} label={label} />
        ))}
      </StatRow>

      <section aria-labelledby="cursors" className="flex flex-col gap-4">
        <h2 id="cursors" className="type-section text-ink">
          Cursors
        </h2>
        <Table framed className="min-w-[40rem]">
          <TableHeader>
            <TableRow>
              {["Source", "Cursor", "Last run", "Last success", "State", "Last error"].map((heading) => (
                <TableHead key={heading}>{heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.states.map((state) => (
              <TableRow key={state.source}>
                <TableCell className="font-mono text-xs">{state.source}</TableCell>
                <TableCell className="font-mono text-xs">{state.cursor ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{when(state.lastRunAt)}</TableCell>
                <TableCell className="whitespace-nowrap">{when(state.lastSuccessAt)}</TableCell>
                <TableCell>{state.locked ? "running" : state.resuming ? "window in progress" : "idle"}</TableCell>
                <TableCell className="max-w-xs truncate text-danger">{state.lastError ?? ""}</TableCell>
              </TableRow>
            ))}
            {overview.states.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-ink-2">
                  Ingestion has not run yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby="runs" className="flex flex-col gap-4">
        <h2 id="runs" className="type-section text-ink">
          Recent runs
        </h2>
        <Table framed className="min-w-[44rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Pages</TableHead>
              <TableHead numeric>Releases</TableHead>
              <TableHead numeric>Awards</TableHead>
              <TableHead numeric>Suppliers</TableHead>
              <TableHead numeric>429s</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview.runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="whitespace-nowrap">{when(run.startedAt)}</TableCell>
                <TableCell>{run.mode}</TableCell>
                <TableCell>{run.status}</TableCell>
                <TableCell numeric>{run.pages}</TableCell>
                <TableCell numeric>{run.releases}</TableCell>
                <TableCell numeric>{run.awards}</TableCell>
                <TableCell numeric>{run.suppliersTouched}</TableCell>
                <TableCell numeric>{run.rateLimited}</TableCell>
                <TableCell className="max-w-xs truncate text-danger">{run.error ?? ""}</TableCell>
              </TableRow>
            ))}
            {overview.runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-ink-2">
                  No runs recorded.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
