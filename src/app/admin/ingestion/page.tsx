import type { Metadata } from "next";
import { getIngestionOverview } from "@/features/procurement/ingest/run";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Data ingestion" };

const when = (iso: string | null) => (iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : "—");

/** Founder view of the Find a Tender ingestion: cursors, recent runs, table sizes. Link it from the admin nav at integration. */
export default async function AdminIngestionPage() {
  await requireAdminForPage();
  const overview = await getIngestionOverview();
  const counts: Array<[string, number]> = [
    ["Notices", overview.counts.notices],
    ["Open tenders", overview.counts.liveTenders],
    ["Current awards", overview.counts.awards],
    ["Suppliers", overview.counts.suppliers],
    ["Buyers", overview.counts.buyers],
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data ingestion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find a Tender feed. Newest notice: {when(overview.counts.newestNoticeAt)}.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-GB")}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="cursors" className="space-y-3">
        <h2 id="cursors" className="text-lg font-semibold">
          Cursors
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Source", "Cursor", "Last run", "Last success", "State", "Last error"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.states.map((state) => (
                <tr key={state.source} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{state.source}</td>
                  <td className="px-3 py-2 font-mono text-xs">{state.cursor ?? "—"}</td>
                  <td className="px-3 py-2">{when(state.lastRunAt)}</td>
                  <td className="px-3 py-2">{when(state.lastSuccessAt)}</td>
                  <td className="px-3 py-2">{state.locked ? "running" : state.resuming ? "window in progress" : "idle"}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-destructive">{state.lastError ?? ""}</td>
                </tr>
              ))}
              {overview.states.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Ingestion has not run yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="runs" className="space-y-3">
        <h2 id="runs" className="text-lg font-semibold">
          Recent runs
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {["Started", "Mode", "Status", "Pages", "Releases", "Awards", "Suppliers", "429s", "Error"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 py-2 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.runs.map((run) => (
                <tr key={run.id} className="border-t tabular-nums">
                  <td className="px-3 py-2">{when(run.startedAt)}</td>
                  <td className="px-3 py-2">{run.mode}</td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">{run.pages}</td>
                  <td className="px-3 py-2">{run.releases}</td>
                  <td className="px-3 py-2">{run.awards}</td>
                  <td className="px-3 py-2">{run.suppliersTouched}</td>
                  <td className="px-3 py-2">{run.rateLimited}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-destructive">{run.error ?? ""}</td>
                </tr>
              ))}
              {overview.runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    No runs recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
