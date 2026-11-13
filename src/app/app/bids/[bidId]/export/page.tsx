import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getBidCapabilities } from "@/features/bids/access";
import { effectiveWordLimit, GAP_PATTERN } from "@/features/bids/answer-text";
import { Callout, StandingNotice, UpgradeNotice } from "@/features/bids/components/ui";
import { countWords } from "@/features/bids/constants";
import { loadBidPage } from "@/features/bids/server/page-data";

export const metadata: Metadata = { title: "Export" };
export const dynamic = "force-dynamic";

function ExportRow({ icon, title, description, href, label, disabled }: { icon: React.ReactNode; title: string; description: string; href: string; label: string; disabled?: boolean }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      <span className="hidden shrink-0 text-muted-foreground sm:block">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {disabled ? (
        <Button size="sm" variant="outline" disabled>
          <Download aria-hidden className="size-3.5" />
          {label}
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          {/* A plain link: the browser downloads the file the server generates. */}
          <a href={href} download data-testid={`export-${href.split("/").pop()}`}>
            <Download aria-hidden className="size-3.5" />
            {label}
          </a>
        </Button>
      )}
    </li>
  );
}

/** Export tab: answers (Word), the cited bid check (Word), the requirements checklist (Word, CSV). */
export default async function ExportPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { ctx, bid, requirements, questions } = await loadBidPage(bidId);
  const capabilities = await getBidCapabilities(ctx.organization.id, bid);
  const base = `/api/bids/${bid.id}/export`;
  const answered = questions.filter((question) => question.draftText?.trim());
  const withGaps = answered.filter((question) => new RegExp(GAP_PATTERN.source, "i").test(question.draftText ?? ""));
  const overLimit = answered.filter((question) => {
    const { limit } = effectiveWordLimit(question);
    return limit !== null && countWords(question.draftText ?? "") > limit;
  });
  const notReady = bid.status === "processing" || bid.status === "failed";

  return (
    <div className="space-y-5">
      <StandingNotice />
      {notReady ? <Callout>The check has not finished, so exports would be incomplete. They unlock when it is ready.</Callout> : null}

      <section aria-label="Answers">
        <h2 className="text-base font-semibold">Answers</h2>
        {!capabilities.exportAnswers ? (
          <UpgradeNotice className="mt-2" title="Answer export is part of Bid Desk">
            Export every answer as one Word document with question references and word counts against the limits. Included with Bid Desk (£149/month) or a Bid Pass (£99) for this bid.
          </UpgradeNotice>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="export-summary">
              {answered.length} of {questions.length} questions have an answer.
            </p>
            {withGaps.length > 0 ? (
              <Callout className="mt-2" tone="warning" title={`${withGaps.length} answer${withGaps.length === 1 ? " still has" : "s still have"} “Evidence needed” placeholders`}>
                {withGaps.map((question) => question.ref || question.title || "Question").join(", ")}. They are highlighted in the export so they cannot be submitted by accident.
              </Callout>
            ) : null}
            {overLimit.length > 0 ? (
              <Callout className="mt-2" tone="danger" title={`${overLimit.length} answer${overLimit.length === 1 ? " is" : "s are"} over the word limit`}>
                {overLimit.map((question) => question.ref || question.title || "Question").join(", ")}.
              </Callout>
            ) : null}
            <ul className="mt-2 divide-y rounded-lg border bg-card">
              <ExportRow
                icon={<FileText aria-hidden className="size-5" />}
                title="All answers (Word)"
                description="Question reference, question, word count against the limit and your answer. Source markers are removed; evidence placeholders stay highlighted."
                href={`${base}/answers`}
                label="Download .docx"
                disabled={notReady || answered.length === 0}
              />
            </ul>
            {answered.length === 0 && !notReady ? <p className="mt-2 text-sm text-muted-foreground">Draft or write at least one answer on the Questions tab first.</p> : null}
          </>
        )}
      </section>

      <section aria-label="Cited bid check">
        <h2 className="text-base font-semibold">Cited bid check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {requirements.length} requirement{requirements.length === 1 ? "" : "s"}, with quotes and sources. Useful for a bid/no-bid meeting or to hand a colleague the checklist.
        </p>
        <ul className="mt-2 divide-y rounded-lg border bg-card">
          <ExportRow
            icon={<FileText aria-hidden className="size-5" />}
            title="Full check (Word)"
            description="Verdict, key facts and dates, evaluation model, red flags, requirements checklist, questions, and what was read."
            href={`${base}/brief`}
            label="Download .docx"
            disabled={notReady}
          />
          <ExportRow
            icon={<FileText aria-hidden className="size-5" />}
            title="Requirements checklist (Word)"
            description="The compliance matrix by category with your position, the source quote and your “checked” ticks."
            href={`${base}/requirements-docx`}
            label="Download .docx"
            disabled={notReady}
          />
          <ExportRow
            icon={<FileSpreadsheet aria-hidden className="size-5" />}
            title="Requirements checklist (CSV)"
            description="One row per requirement, for Excel or your own tracker."
            href={`${base}/requirements-csv`}
            label="Download .csv"
            disabled={notReady}
          />
        </ul>
      </section>
    </div>
  );
}
