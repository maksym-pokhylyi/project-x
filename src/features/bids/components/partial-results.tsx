import "./bid-theme.css";
import Link from "next/link";
import { verificationState } from "@/features/bids/citation-state";
import { displayRef, isScoredQuestion, type CoverageSummary, type PackFileItem } from "@/features/bids/view";
import { cn } from "@/lib/utils";
import { CitationMark, SourceLegend, type SourceLinks } from "./citation";
import type { QuestionItem } from "./questions-view";
import type { RequirementItem } from "./requirements-view";
import { StatusPill } from "./ui";

/**
 * What a check has found while it is still being built (design handoff: Processing).
 * Real rows only: requirements and questions appear as the readings land, each requirement
 * says "Not checked yet" until the company stage has run, and rows that are still to come
 * are shown as placeholders — never as guessed counts.
 */
export function PartialResults({
  bidId,
  basePath,
  requirements,
  questions,
  files,
  coverage,
  companyChecked,
  questionsListed,
}: {
  bidId: string;
  basePath: string;
  requirements: RequirementItem[];
  questions: QuestionItem[];
  files: PackFileItem[];
  coverage: CoverageSummary;
  /** True once the "checking against your company" stage has finished. */
  companyChecked: boolean;
  /** True once the "listing questions" stage has finished. */
  questionsListed: boolean;
}) {
  const links: SourceLinks = { kind: "app", bidId };
  const shown = requirements.slice(0, 5);
  const scored = questions.filter(isScoredQuestion);
  const skipped = files.filter((file) => !file.read && file.size === "not read").length;
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-10" data-testid="partial-results">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-12">
        <section aria-labelledby="partial-req-h" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="partial-req-h" className="bid-h2">
              Requirements found so far <span className="bid-mono text-sm font-normal text-ink-2 tabular-nums">· {requirements.length}</span>
            </h2>
            <p className="text-sm text-ink-2">Each line is quoted word for word from the pack. Open a reference to read it on the page. They are checked against your company in the last stage.</p>
            <SourceLegend className="mt-1" />
          </div>
          <div className="bid-card">
            {shown.length === 0 ? (
              <ul aria-hidden className="flex flex-col">
                {[72, 56, 64].map((width, index) => (
                  <li key={index} className={cn("flex flex-col gap-3 px-4 py-5 sm:px-6", index > 0 ? "bid-rule" : "")}>
                    <span className="h-3.5 rounded bg-paper-deep" style={{ width: `${width}%` }} />
                    <span className="h-3 w-40 rounded bg-paper-deep" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="flex flex-col">
                {shown.map((item, index) => {
                  const quoted = Boolean(item.citation?.quote) && item.citation !== null && verificationState(item.citation) !== "unverified";
                  return (
                    <li key={item.id} className={cn("flex flex-wrap items-start gap-x-6 gap-y-3 px-4 py-[18px] sm:px-6", index > 0 ? "bid-rule" : "")} data-testid="partial-requirement">
                      <span className="bid-mono w-full shrink-0 pt-1 text-13 font-medium sm:w-14">{displayRef(item.ref)}</span>
                      <div className="flex min-w-0 flex-[1_1_380px] flex-col items-start gap-2.5">
                        {quoted ? <p className="bid-quote">“{item.citation!.quote}”</p> : <p className="text-15 leading-[1.5]">{item.text}</p>}
                        <CitationMark citation={item.citation} links={links} />
                      </div>
                      <div className="flex-[0_1_160px]">{companyChecked ? <StatusPill status={item.companyStatus} /> : <span className="bid-pill bid-pill-neutral">Not checked yet</span>}</div>
                    </li>
                  );
                })}
              </ul>
            )}
            {requirements.length > shown.length ? (
              <div className="bid-rule px-4 py-1 sm:px-6">
                <Link href={`${basePath}/requirements`} className="bid-link inline-flex min-h-11 items-center text-sm font-medium">
                  Show all {requirements.length}
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="partial-q-h" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="partial-q-h" className="bid-h2">
              Scored questions found so far <span className="bid-mono text-sm font-normal text-ink-2 tabular-nums">· {scored.length}</span>
            </h2>
            <p className="text-sm text-ink-2">Weights and word limits are the buyer&rsquo;s. {questionsListed ? "" : "More questions may still be listed."}</p>
          </div>
          <div className="bid-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-2">
                    <th scope="col" className="border-b border-line py-3 pr-3 pl-6 font-semibold">Question</th>
                    <th scope="col" className="border-b border-line p-3 text-right font-semibold">Weight</th>
                    <th scope="col" className="border-b border-line py-3 pr-6 pl-3 text-right font-semibold">Word limit</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map((question) => (
                    <tr key={question.id}>
                      <td className="border-b border-line py-3.5 pr-3 pl-6">
                        {question.ref ? <span className="bid-mono mr-2.5 text-13 text-ink-2">{question.ref}</span> : null}
                        <span className="font-semibold">{question.title ?? question.text.slice(0, 90)}</span>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 text-right tabular-nums">{question.weighting !== null ? `${question.weighting}%` : "—"}</td>
                      <td className="border-b border-line py-3.5 pr-6 pl-3 text-right tabular-nums">{question.wordLimit ? question.wordLimit.toLocaleString("en-GB") : "—"}</td>
                    </tr>
                  ))}
                  {questionsListed
                    ? null
                    : [44, 28].map((width, index) => (
                        <tr key={`skeleton-${index}`} aria-hidden>
                          <td className={cn("py-4 pr-3 pl-6", index === 0 ? "border-b border-line" : "")}>
                            <span className="block h-3 rounded bg-paper-deep" style={{ width: `${width}%` }} />
                          </td>
                          <td className={cn("px-3 py-4", index === 0 ? "border-b border-line" : "")}>
                            <span className="ml-auto block h-3 w-8 rounded bg-paper-deep" />
                          </td>
                          <td className={cn("py-4 pr-6 pl-3", index === 0 ? "border-b border-line" : "")}>
                            <span className="ml-auto block h-3 w-10 rounded bg-paper-deep" />
                          </td>
                        </tr>
                      ))}
                  {questionsListed && scored.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-5 text-ink-2">
                        No scored written questions were found in the pack.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
        <section aria-labelledby="coverage-h" className="bid-card px-5 pt-[18px] pb-2" data-testid="coverage-card">
          <h2 id="coverage-h" className="bid-h3">
            Coverage{" "}
            <span className="font-normal text-ink-2">
              · {coverage.read} {coverage.read === 1 ? "file" : "files"} read{skipped > 0 ? `, ${skipped} skipped` : ""}
            </span>
          </h2>
          <ul className="mt-2 flex flex-col text-xs">
            {files.map((file) => (
              <li key={file.id} className="flex min-h-10 items-center justify-between gap-3 border-t border-line">
                {file.read ? (
                  <a href={`/api/bids/${bidId}/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="bid-mono bid-link-quiet min-w-0 truncate" title={file.name}>
                    {file.name}
                  </a>
                ) : (
                  <span className="bid-mono min-w-0 truncate text-ink-2" title={file.name}>
                    {file.name}
                  </span>
                )}
                <span className={cn("max-w-[55%] shrink-0 text-right", file.read ? "text-ink-2" : file.size === "reading…" ? "text-ink-2" : "font-semibold")} title={file.note ?? undefined}>
                  {file.read ? file.size : file.size === "reading…" ? "reading…" : `Skipped: ${file.note ? file.note.replace(/\.$/, "").slice(0, 60) : "not readable"}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
