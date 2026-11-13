import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd } from "@/components/marketing/json-ld";
import { Eyebrow, Point, Section, SectionHeading } from "@/components/marketing/section";
import { KeyDatesCard, ScoredQuestionsCard, VerdictPanel } from "@/components/marketing/visuals/brief-visuals";
import { DocumentExcerpt, ProofBridge, RequirementCard } from "@/components/marketing/visuals/proof-visuals";
import { Button } from "@/components/ui/button";
import { landing } from "@/config/landing";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Free cited bid check",
  description:
    "Upload a tender pack and get a free cited bid check: every pass-or-fail requirement, key date and scored question quoted from the buyer's documents with file and page, and a plain verdict.",
  alternates: { canonical: "/free-bid-check" },
};

/** Sign-up carries the destination along; `next` is read by the sign-up and sign-in pages. */
const START_HREF = "/sign-up?next=/app/bids/new";
const { facts } = site;

const contents = [
  {
    title: "A verdict, with its reasons",
    body: "A plain sentence on whether you can comply, and the requirements behind it listed underneath.",
  },
  {
    title: "Every pass-or-fail requirement",
    body: "Insurance, finance, accreditations, experience, policies. Each one quoted, with file and page, and marked Met, Gap or For you to confirm.",
  },
  {
    title: "Key dates",
    body: "The clarification deadline, site visits, the tender deadline and the contract start, each with the page it was read from.",
  },
  {
    title: "The scored questions",
    body: "Every question the buyer will mark, with its weighting and its word or page limit.",
  },
  {
    title: "How the bid is marked",
    body: "The split between quality and price, the scoring scale and any minimum score that fails a bid.",
  },
  {
    title: "Terms to read yourself",
    body: "Clauses that change your price or your risk: TUPE, deductions for late attendance, fixed rates.",
  },
];

/** Set apart from the list above: it is the part that makes the rest trustworthy. */
const notFound = {
  title: "And what we could not find",
  body: "Anything a pack of this kind normally contains but this one does not, and any quote that could not be matched to the source text, is listed separately and marked “For you to confirm”, so you know exactly what to check yourself.",
};

const steps = [
  { time: "1 minute", title: "Create a free account", body: "Name, work email and a password. No card." },
  {
    time: "1 minute",
    title: "Upload the tender pack",
    body: "PDF, Word, Excel or a zip of all of them. Up to 50 MB a file and 200 MB a pack.",
  },
  {
    time: "1 to 3 minutes",
    title: "The pack is read",
    body: "You see each stage as it happens. You can close the tab: the check carries on and is there when you come back.",
  },
  { time: "As long as you like", title: "Read the check", body: "Open any reference to see the quote on its page. Correct anything that is wrong." },
];

const privacy = [
  { title: "Yours, and confidential", body: "Files you upload are your confidential data. We do not share them with buyers, other suppliers or anyone else." },
  { title: "Stored in the EU", body: `Files and results are stored in ${facts.hostingRegion}. Only members of your workspace can open them.` },
  { title: "Never used to train AI", body: "The text is sent to AI model providers only to produce your check. It is not used to train their models, or ours." },
  { title: "Deleted when you say so", body: "Delete a bid and its files at any time. Ask us and we delete everything your workspace holds." },
];

const faq: FaqItem[] = [
  {
    question: "Is the first check really free?",
    answer: "Yes. One cited bid check per company, with no card. After that, Radar Pro includes one a month, and every full bid on Bid Desk or a Bid Pass starts with one.",
  },
  {
    question: "The documents are on a procurement portal. Can Bidfolio fetch them?",
    answer: "No. Bidfolio does not log in to portals. Download the documents from the buyer’s portal and upload them, or upload the zip the portal gives you.",
  },
  {
    question: "What if the pack is a scan?",
    answer:
      "Scanned and low-quality files are read less reliably. The check warns you when a file looks like a scan, and marks anything it could not match to the text as “For you to confirm”.",
  },
  {
    question: "Our tender pack came with confidentiality terms. Can we upload it?",
    answer:
      "Check the terms first. Some buyers restrict sharing tender documents with third parties, and that includes any software service. If the terms allow you to use suppliers and tools to prepare your bid, you can.",
  },
  {
    question: "How accurate is it?",
    answer:
      "Every finding carries its quote, file and page so that you can verify it in seconds, and quotes are checked against the source text by the software. It is AI-assisted analysis and it can miss things: read the documents that matter. You remain responsible for your submission.",
  },
];

export default function FreeBidCheckPage() {
  const { proof } = landing;
  return (
    <>
      <JsonLd data={faqJsonLd(faq)} />

      {/* Hero ---------------------------------------------------------------------------- */}
      <section aria-labelledby="check-hero-title">
        <div className="container-content grid gap-y-10 pt-8 pb-14 md:pt-14 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-x-12 lg:pt-16 lg:pb-[5.5rem] xl:gap-x-14">
          <div className="flex max-w-[38rem] flex-col gap-5 md:gap-6">
            <Eyebrow>Free cited bid check</Eyebrow>
            <h1 id="check-hero-title" className="type-h1 text-ink">
              Check a tender pack before you spend a week on it.
            </h1>
            <p className="type-lead text-ink">
              Upload the pack as the buyer sent it. A few minutes later you have every pass-or-fail requirement, key date and scored question, each quoted word for
              word with its file and page, and a plain verdict on whether you can comply.
            </p>
            <div className="mt-1 flex flex-col gap-2.5 sm:flex-row md:mt-2">
              <Button asChild size="lg">
                <Link href={START_HREF}>
                  Create an account and upload <ArrowRight aria-hidden strokeWidth={2.2} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sample-check">See a sample check</Link>
              </Button>
            </div>
            <p className="text-13 text-ink-2">Your first check is free. No card needed.</p>
          </div>
          <VerdictPanel className="w-full max-w-[38rem] lg:max-w-none" />
        </div>
      </section>

      {/* What it contains ---------------------------------------------------------------- */}
      <Section labelledBy="contents-title" tone="deep" containerClassName="flex flex-col gap-9 md:gap-14">
        <SectionHeading
          id="contents-title"
          eyebrow="What you get"
          title="What the free check contains"
          lead="It is the same check that starts every paid bid, on your own tender pack."
        />
        <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((item) => (
            <li key={item.title}>
              <Point title={item.title}>{item.body}</Point>
            </li>
          ))}
        </ul>
        <div role="note" className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-5 py-5 sm:px-6">
          <h3 className="font-sans text-17 font-semibold text-ink">{notFound.title}</h3>
          <p className="max-w-[45rem] text-15 leading-[1.45rem] text-ink">{notFound.body}</p>
        </div>
      </Section>

      {/* Proof --------------------------------------------------------------------------- */}
      <Section labelledBy="check-proof-title" containerClassName="flex flex-col gap-9 md:gap-14">
        <SectionHeading id="check-proof-title" eyebrow={proof.eyebrow} title={proof.title} lead={proof.lead} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-10">
          <DocumentExcerpt className="min-w-0 lg:flex-[1_1_27.5rem]" />
          <ProofBridge className="lg:hidden">{proof.bridge}</ProofBridge>
          <RequirementCard className="min-w-0 lg:flex-[1.25_1_31.25rem]" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <KeyDatesCard />
          <ScoredQuestionsCard />
        </div>
        <p className="text-13 text-ink-2">
          Samples with fictional data. AI-assisted analysis: check it against the tender documents. You remain responsible for your submission.
        </p>
      </Section>

      {/* How long it takes --------------------------------------------------------------- */}
      <Section labelledBy="time-title" tone="deep" containerClassName="flex flex-wrap gap-x-20 gap-y-8">
        <SectionHeading
          id="time-title"
          eyebrow="How long it takes"
          title="About ten minutes, start to finish"
          lead="Most packs are read in one to three minutes. Large packs with many files take a little longer."
          className="min-w-0 flex-[1_1_18.75rem]"
        />
        <ol className="min-w-0 flex-[2_1_35rem] border-b border-line">
          {steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2.25rem_1fr] gap-x-2 border-t border-line py-5 sm:grid-cols-[2.25rem_1fr_9rem]">
              <span aria-hidden className="pt-0.5 font-mono text-13 text-ink-2">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-sans text-17 font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-15 leading-[1.45rem] text-ink">{step.body}</p>
              </div>
              <p className="col-start-2 mt-2 text-13 text-ink-2 tabular-nums sm:col-start-3 sm:mt-1 sm:text-right">{step.time}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Your files ---------------------------------------------------------------------- */}
      <Section labelledBy="privacy-title" containerClassName="flex flex-wrap gap-x-20 gap-y-9">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-3">
          <Eyebrow>Your files</Eyebrow>
          <h2 id="privacy-title" className="type-h2 text-ink">
            A tender pack is commercial. We treat it that way.
          </h2>
          <p className="type-reading mt-1 text-ink-2">
            The detail is in the <Link href="/legal/privacy">privacy notice</Link>, the <Link href="/legal/terms">terms</Link> and the{" "}
            <Link href="/legal/dpa">data processing agreement</Link>.
          </p>
        </div>
        <dl className="grid min-w-0 flex-[2_1_35rem] gap-x-8 gap-y-7 sm:grid-cols-2">
          {privacy.map((item) => (
            <div key={item.title} className="flex flex-col gap-1.5 border-t-2 border-ink pt-[1.125rem]">
              <dt className="text-17 font-semibold text-ink">{item.title}</dt>
              <dd className="text-15 leading-[1.45rem] text-ink">{item.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Questions ----------------------------------------------------------------------- */}
      <Section labelledBy="check-faq-title" tone="surface" containerClassName="flex flex-wrap gap-x-20 gap-y-8">
        <div className="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-3">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="check-faq-title" className="type-h2 text-ink">
            Before you upload
          </h2>
        </div>
        <div className="min-w-0 flex-[2_1_35rem]">
          <Faq items={faq} />
        </div>
      </Section>

      {/* Closing call to action ---------------------------------------------------------- */}
      <section aria-labelledby="check-cta-title">
        <div className="container-content flex flex-wrap items-center justify-between gap-x-14 gap-y-7 py-14 md:py-20">
          <h2 id="check-cta-title" className="max-w-[35rem] min-w-0 flex-[1_1_26.25rem] font-display text-3xl font-semibold tracking-[-0.015em] text-ink md:text-4xl">
            Have a live tender? Check it now.
          </h2>
          <div className="flex min-w-0 flex-[0_1_auto] flex-col gap-3">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button asChild size="lg">
                <Link href={START_HREF}>
                  Create an account and upload <ArrowRight aria-hidden strokeWidth={2.2} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sample-check">See a sample check</Link>
              </Button>
            </div>
            <p className="text-13 text-ink-2">Your first check is free. No card needed.</p>
          </div>
        </div>
      </section>
    </>
  );
}
