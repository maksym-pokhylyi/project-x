import { ArrowRight, CalendarClock, CircleHelp, FileSearch, Flag, ListChecks, Scale, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd, faqJsonLd } from "@/components/marketing/json-ld";
import { Eyebrow, Section, SectionHeading } from "@/components/marketing/section";
import { KeyDatesCard, QuestionsCard } from "@/components/marketing/visuals/check-details";
import { CheckVisual } from "@/components/marketing/visuals/check-visual";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Free cited bid check",
  description:
    "Upload a tender pack and get a free cited bid check: every pass/fail requirement, key date and scored question quoted from the buyer's documents with file and page, and a plain verdict.",
  alternates: { canonical: "/free-bid-check" },
};

/** Sign-up carries the destination along; `next` is read by the sign-up and sign-in pages. */
const START_HREF = "/sign-up?next=/app/bids/new";
const { facts } = site;

const contents = [
  {
    icon: Scale,
    title: "A verdict, with its reasons",
    body: "Bid, bid with gaps, or likely not eligible. The requirements behind the verdict are listed under it.",
  },
  {
    icon: ShieldCheck,
    title: "Every pass/fail requirement",
    body: "Insurance, finance, accreditations, experience, policies. Each one quoted, with file and page, and marked Met, Gap or Verify against your company.",
  },
  {
    icon: CalendarClock,
    title: "Key dates",
    body: "Clarification deadline, site visits, the tender deadline and the contract start, each with the page it was read from.",
  },
  {
    icon: ListChecks,
    title: "The scored questions",
    body: "Every question the buyer will mark, with its weighting and its word or page limit.",
  },
  {
    icon: FileSearch,
    title: "How the bid is scored",
    body: "The split between quality and price, the scoring scale and any minimum score that fails a bid.",
  },
  {
    icon: Flag,
    title: "Red flags",
    body: "Terms that deserve a second look before you commit: TUPE, liquidated damages, a short mobilisation.",
  },
  {
    icon: CircleHelp,
    title: "What we could not find",
    body: "Anything expected but missing, and any quote we could not match to the source text, is listed so you can check it yourself.",
  },
];

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
  { time: "As long as you like", title: "Read the check", body: "Open any citation to see the quote at its source page. Edit anything that is wrong." },
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
    answer: "Scanned and low-quality files can be read less reliably. The check warns you when a file looks like a scan, and marks anything it could not match to the text as “Verify in documents”.",
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
  return (
    <>
      <JsonLd data={faqJsonLd(faq)} />

      <section aria-labelledby="check-hero-title" className="overflow-hidden">
        <div className="container-content grid gap-12 pt-12 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-center lg:gap-14 lg:pt-16 lg:pb-24">
          <div className="max-w-xl">
            <Eyebrow>Free cited bid check</Eyebrow>
            <h1 id="check-hero-title" className="type-h1 mt-3 text-ink">
              Check a tender pack before you spend a week on it.
            </h1>
            <p className="type-lead mt-5">
              Upload the pack. A few minutes later you have every pass/fail requirement, key date and scored question, each quoted from the buyer’s documents with its
              file and page, and a plain verdict: bid, bid with gaps, or likely not eligible.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={START_HREF}>
                  Create an account and upload <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sample-check">See a sample check</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-2">Your first check is free. No card needed.</p>
          </div>
          <CheckVisual elevated />
        </div>
      </section>

      <Section labelledBy="contents-title" tone="sunken">
        <SectionHeading
          id="contents-title"
          eyebrow="What you get"
          title="What the free check contains"
          lead="It is the same check that starts every paid bid, on your own tender pack."
        />
        <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((item) => (
            <li key={item.title} className="grid grid-cols-[1.5rem_1fr] gap-x-3">
              <item.icon aria-hidden className="mt-0.5 size-5 text-brand" />
              <div>
                <h3 className="font-sans text-base leading-6 font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-base text-ink-2">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <KeyDatesCard />
          <QuestionsCard />
        </div>
        <p className="mt-4 text-13 text-ink-2">Samples with fictional data. AI-assisted analysis: check it against the tender documents. You remain responsible for your submission.</p>
      </Section>

      <Section labelledBy="time-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <SectionHeading
            id="time-title"
            eyebrow="How long it takes"
            title="About ten minutes, start to finish."
            lead="Most packs are read in one to three minutes. Large packs with many files take a little longer."
            className="lg:col-span-5"
          />
          <ol className="lg:col-span-7">
            {steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-x-3 border-t border-line-strong py-5 sm:grid-cols-[2rem_1fr_9rem]">
                <span aria-hidden className="font-display text-xl leading-6 font-medium text-brand tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-sans text-base leading-6 font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-base text-ink-2">{step.body}</p>
                </div>
                <p className="col-start-2 mt-2 text-13 text-ink-2 tabular-nums sm:col-start-3 sm:mt-0.5 sm:text-right">{step.time}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section labelledBy="privacy-title" tone="sunken">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <SectionHeading
              id="privacy-title"
              eyebrow="Your files"
              title="A tender pack is commercial. We treat it that way."
              lead="Four things you can rely on, and where they are written down."
            />
            <p className="mt-4 text-base text-ink-2">
              The detail is in the <Link href="/legal/privacy">privacy notice</Link>, the <Link href="/legal/terms">terms</Link> and the{" "}
              <Link href="/legal/dpa">data processing agreement</Link>.
            </p>
          </div>
          <dl className="grid gap-x-8 sm:grid-cols-2 lg:col-span-7">
            {privacy.map((item) => (
              <div key={item.title} className="border-t border-line-strong py-5">
                <dt className="text-base leading-6 font-semibold text-ink">{item.title}</dt>
                <dd className="mt-1 text-base text-ink-2">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section labelledBy="check-faq-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <SectionHeading id="check-faq-title" title="Before you upload" className="lg:col-span-5" />
          <div className="lg:col-span-7">
            <Faq items={faq} />
          </div>
        </div>
      </Section>

      <CtaBand
        id="check-cta-title"
        title="Have a live tender? Check it now."
        lead="Create a free account, upload the pack and read your cited check a few minutes later."
        primary={{ label: "Create an account and upload", href: START_HREF }}
        secondary={{ label: "See a sample check", href: "/sample-check" }}
        footnote="Your first check is free. No card needed."
      />
    </>
  );
}
