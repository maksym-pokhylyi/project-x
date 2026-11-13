import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { effectiveWordLimit } from "@/features/bids/answer-text";
import { AnswerEditor } from "@/features/bids/components/answer-editor";
import { BriefView } from "@/features/bids/components/brief-view";
import { RequirementsView } from "@/features/bids/components/requirements-view";
import { StandingNotice } from "@/features/bids/components/ui";
import { countWords } from "@/features/bids/constants";
import { loadSampleCheck } from "@/features/bids/sample/load";
import { DEFAULT_SCALE } from "@/features/bids/server/drafting";
import type { QuestionStatus } from "@/features/bids/types";
import { coverageSummary, toEditorQuestion, toPackFileItems, toQuestionItem, toRequirementItem } from "@/features/bids/view";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Sample cited bid check",
  description: "A real cited bid check, built from a tender pack a UK council published: every requirement quoted from the pack with its page, checked against a (fictional) bidder.",
};
// Public and read-only: rendered once and refreshed hourly, never per visitor.
export const revalidate = 3600;

const CTA_HREF = "/sign-up?next=/app/bids/new";

function Cta({ className }: { className?: string }) {
  return (
    <ButtonLink href={CTA_HREF} className={className} data-testid="sample-cta">
      Get a free cited bid check
      <ArrowRight aria-hidden className="size-4" />
    </ButtonLink>
  );
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/**
 * Public sample: one finished bid of the demo organisation, shown exactly as a customer
 * sees it — the Brief, every requirement, and one drafted answer with the evaluator's view
 * — read-only, with source links to where the buyer published each document.
 */
export default async function SampleCheckPage() {
  const sample = await loadSampleCheck();
  if (!sample) notFound();
  const { bid, source } = sample;
  const links = { kind: "public" as const, urls: sample.fileUrls };
  const requirements = sample.requirements.map(toRequirementItem);
  const questions = sample.questions.map(toQuestionItem);
  const question = sample.sampleQuestion;
  const packScale = (bid.evaluationModel?.scoringScale ?? []).filter((row) => row.score.trim() !== "");
  const usePack = packScale.length >= 2;

  return (
    <div className="bg-paper" id="top">
      <div className="text-15 text-ink sticky top-0 z-20 border-b border-line bg-surface" data-testid="sample-cta-bar">
        <div className=" mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-8">
          <p className="text-sm">
            <span className="font-semibold">A sample check, built from a real public tender pack.</span>{" "}
            <span className="text-ink-2">Company details are an example. Nothing here can be edited.</span>
          </p>
          <ButtonLink href={CTA_HREF}>
            Get a free cited bid check
          </ButtonLink>
        </div>
      </div>
      <div className="text-15 text-ink mx-auto flex max-w-[1280px] flex-col px-4 pt-8 pb-16 sm:px-8" data-testid="sample-check">
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-2">
            <p className="self-start rounded-control bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand" data-testid="sample-band">
              A sample check, built from a real public tender pack
            </p>
            <p className="font-mono text-xs text-ink-2">
              Read-only · {sample.files.filter((file) => file.kind !== "zip").length} files as published by the buyer
            </p>
            <h1 className="type-title [overflow-wrap:anywhere]">{source.title}</h1>
            <p className="text-15">
              {source.buyer} <span className="text-ink-2">· {bid.title}</span>
            </p>
            <p className="max-w-[760px] text-sm">
              This is a real check, produced by Bidfolio from the tender pack {source.buyer} published for this contract. Nothing about the tender has been edited. The bidder is <strong>the example company</strong>: a fictional
              firm whose company facts and documents were made up so that the check has something to compare the requirements with.
            </p>
            <p className="text-13 text-ink-2" data-testid="sample-source">
              Source documents: published by {source.buyer} on{" "}
              <a href={source.documentsPage} target="_blank" rel="noopener noreferrer" className="link">
                {hostOf(source.documentsPage)}
              </a>{" "}
              ·{" "}
              <a href={source.noticeUrl} target="_blank" rel="noopener noreferrer" className="link">
                the buyer&rsquo;s tender notice
              </a>{" "}
              · retrieved {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${source.retrieved}T12:00:00Z`))}. This tender has closed.
            </p>
            <p className="text-13 text-ink-2" data-testid="sample-removal">
              The tender documents belong to the buyer; we quote them to show how a check reads. Ask us to remove this sample:{" "}
              <a href="mailto:hello@bidfolio.co.uk" className="link">
                hello@bidfolio.co.uk
              </a>
              .
            </p>
          </div>
          <Cta />
        </header>

        <StandingNotice className="mt-6 border-t border-line pt-3" />

        <div className="mt-7">
          <BriefView
            bidId={bid.id}
            brief={bid.brief}
            verdict={bid.verdict}
            evaluationModel={bid.evaluationModel}
            keyDates={bid.keyDates}
            packStats={bid.packStats}
            submissionDeadline={bid.submissionDeadline}
            requirements={requirements}
            questions={questions}
            files={toPackFileItems(sample.files, bid.packStats)}
            coverage={coverageSummary(sample.files, bid.packStats)}
            links={links}
            readOnly
            factsConfirmed
            basePath={null}
            libraryHref={null}
            questionHref={(item) => (question && item.id === question.id ? "#sample-answer" : null)}
          />
        </div>

        <section aria-labelledby="all-req-h" className="mt-14 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="all-req-h" className="type-section">
              Every requirement found
            </h2>
            <p className="max-w-[760px] text-sm text-ink-2">
              All {requirements.length} requirements the check drew from the pack, in document order — pass-or-fail tests, forms to sign and submission rules. In your own workspace you can edit them, add your own and tick each one off
              once you have read it on the page.
            </p>
          </div>
          <details className="rounded-card border border-line bg-surface px-4 py-3 sm:px-6" data-testid="sample-all-requirements">
            <summary className="link inline-flex min-h-11 cursor-pointer items-center text-sm font-medium">Show all {requirements.length} requirements</summary>
            <div className="mt-3">
              <RequirementsView bidId={bid.id} requirements={requirements} links={links} readOnly compact />
            </div>
          </details>
        </section>

        {question ? (
          <section aria-labelledby="sample-answer" className="mt-14 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="sample-answer" className="type-section scroll-mt-24">
                One drafted answer, with the evaluator&rsquo;s view
              </h2>
              <p className="max-w-[760px] text-sm text-ink-2">
                A first draft written only from the example company&rsquo;s (fictional) company facts and documents. Where they hold no evidence the draft leaves a gap instead of inventing a fact, and the marking says what an
                evaluator would want to see.
                {sample.draftedToWords && !question.wordLimit ? ` The pack sets no word limit for this question; the draft was written to ${sample.draftedToWords} words.` : ""}
              </p>
            </div>
            <AnswerEditor
              embedded
              bidId={bid.id}
              question={toEditorQuestion(question)}
              scale={usePack ? packScale : DEFAULT_SCALE}
              scaleKind={usePack ? "pack" : "default"}
              links={links}
              locked="sample"
              library={{ factsConfirmed: true, documents: 2 }}
              bid={{ title: bid.title, buyerName: bid.buyerName, deadline: bid.submissionDeadline ? bid.submissionDeadline.toISOString() : null, briefHref: "#top", exportHref: null }}
              nav={{
                items: [
                  {
                    id: question.id,
                    ref: question.ref,
                    title: question.title ?? question.text.slice(0, 80),
                    weighting: question.weighting,
                    wordCount: countWords(question.draftText ?? ""),
                    limit: effectiveWordLimit(question).limit,
                    status: question.status as QuestionStatus,
                    gaps: question.draftMeta?.evidenceGaps.length ?? 0,
                    score: question.evaluation?.score ?? null,
                    href: null,
                  },
                ],
                qualityWeight: bid.evaluationModel?.qualityWeight ?? null,
                previousHref: null,
                nextHref: null,
              }}
              sources={sample.sources}
            />
          </section>
        ) : null}

        <section className="mt-16 flex flex-col items-start gap-4 rounded-card bg-brand-tint px-5 py-7 sm:px-8">
          <h2 className="font-serif text-3xl leading-[1.2] font-semibold sm:text-3xl">Upload your own tender pack and get this for it.</h2>
          <p className="max-w-[680px] text-15">
            Your first cited bid check is free: the verdict, every pass-or-fail requirement quoted from the pack with its page, the scored questions and the terms to read yourself. Drafting and marking are part of Bid Desk.
          </p>
          <Cta />
        </section>
      </div>
    </div>
  );
}
