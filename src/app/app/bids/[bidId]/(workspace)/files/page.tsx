import type { Metadata } from "next";
import { Callout, SectionHeading } from "@/features/bids/components/ui";
import { loadBidPage } from "@/features/bids/server/page-data";
import { coverageSummary, toPackFileItems } from "@/features/bids/view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pack files" };
export const dynamic = "force-dynamic";

/**
 * Pack files tab: honest coverage. Every uploaded file with what was read from it, how
 * many items of the check cite it, and anything that was skipped — so a reader knows
 * where the check is blind.
 */
export default async function FilesPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { bid, files } = await loadBidPage(bidId);
  const done = bid.status === "ready" || bid.status === "archived";
  const items = toPackFileItems(files, done ? bid.packStats : null);
  const coverage = coverageSummary(files, done ? bid.packStats : null);
  const stats = done ? bid.packStats : null;
  const passes = stats?.coverage?.passes ?? [];

  return (
    <div className="flex flex-col gap-6" data-testid="files-view">
      <SectionHeading title="Pack files" lead="What was read, what the check drew from each file, and what it could not read. Open a file to see the original." />

      {coverage.notRead.length + coverage.notAnalysed.length > 0 ? (
        <Callout tone="warning" title={`${coverage.notRead.length + coverage.notAnalysed.length} file${coverage.notRead.length + coverage.notAnalysed.length === 1 ? " was" : "s were"} not part of this check`}>
          Requirements in these files are NOT in the check: {[...coverage.notRead, ...coverage.notAnalysed].join(", ")}. Read them yourself.
        </Callout>
      ) : null}
      {coverage.silentFiles.length > 0 ? (
        <Callout tone="info" title="Read, but nothing was drawn from">
          {coverage.silentFiles.join(", ")}. That is normal for drawings and standard terms; for a form or an appendix, check it yourself.
        </Callout>
      ) : null}

      <div className="bid-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-(--bid-muted)">
                <th scope="col" className="border-b border-(--bid-line) py-3 pr-3 pl-6 font-semibold">File</th>
                <th scope="col" className="border-b border-(--bid-line) p-3 text-right font-semibold">Read</th>
                <th scope="col" className="border-b border-(--bid-line) p-3 text-right font-semibold">Items citing it</th>
                <th scope="col" className="border-b border-(--bid-line) py-3 pr-6 pl-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((file, index) => {
                const cell = cn("py-3 align-top", index < items.length - 1 ? "border-b border-(--bid-line)" : "");
                return (
                  <tr key={file.id} data-testid="pack-file" data-read={file.read ? "true" : "false"}>
                    <td className={cn(cell, "pr-3 pl-6")}>
                      {file.read ? (
                        <a href={`/api/bids/${bid.id}/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="bid-mono bid-link-quiet text-[13px] break-all">
                          {file.name}
                        </a>
                      ) : (
                        <span className="bid-mono text-[13px] break-all">{file.name}</span>
                      )}
                    </td>
                    <td className={cn(cell, "px-3 text-right whitespace-nowrap tabular-nums", file.read && file.analysed ? "" : "font-semibold text-(--bid-danger)")}>
                      {file.read && !file.analysed ? "not analysed" : file.size}
                    </td>
                    <td className={cn(cell, "px-3 text-right tabular-nums")}>{file.items === null ? "—" : file.items}</td>
                    <td className={cn(cell, "pr-6 pl-3 text-[13px]")}>
                      {file.note ??
                        (file.transcribedPages > 0
                          ? `${file.transcribedPages} scanned page${file.transcribedPages === 1 ? "" : "s"} transcribed by AI — check quotes against the original.`
                          : file.read && !file.analysed
                            ? "Left out because the pack was too large."
                            : "")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {stats ? (
        <section aria-labelledby="how-h" className="bid-card flex flex-col gap-3 px-5 py-4 text-sm sm:px-6" data-testid="coverage-detail">
          <h2 id="how-h" className="bid-h3">
            How the pack was read
          </h2>
          <p>
            {coverage.headline}. {stats.citations.verified} of {stats.citations.total} quotes behind the check were found word for word in the text of these files
            {stats.citations.total - stats.citations.verified > 0 ? `; the other ${stats.citations.total - stats.citations.verified} are marked “Check” or “Unverified” where they appear` : ""}.
          </p>
          {passes.length > 0 ? (
            <div>
              <p className="font-medium">Readings that completed</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[13px]">
                {passes.map((pass) => (
                  <li key={pass}>{pass}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {coverage.failedPasses.length > 0 ? (
            <div>
              <p className="font-medium text-(--bid-danger)">Readings that did not complete</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[13px]">
                {coverage.failedPasses.map((pass) => (
                  <li key={pass}>{pass}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[13px] text-(--bid-muted)">
            Two different AI models read the whole pack independently; questionnaires, response templates and clarification files get a reading of their own. Their findings are combined and every quote is checked by
            program, not by a model. Errors are far more often omissions than inventions — so skim the files for anything the check does not mention.
          </p>
          {Object.keys(stats.models).length > 0 ? <p className="bid-mono text-xs text-(--bid-muted)">Models: {[...new Set(Object.values(stats.models).flatMap((value) => value.split(" + ")))].join(", ")}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
