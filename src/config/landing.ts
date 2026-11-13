import { BID_PASS } from "./plan-display";
import { PLANS, formatPrice } from "./plans";
import { site } from "./site";

/**
 * ALL copy of the landing page ("/"), in one place so it can be edited without touching
 * components. Voice: plain British English, second person, short sentences, numbers before
 * adjectives, the buyer's words (tender, bid, buyer, contract, award, framework).
 *
 * Rules that are easy to break (see docs/design/DESIGN.md §2 and the research notes):
 *  - never promise wins, win rates, "100% compliant" or score prediction;
 *  - every figure about the market names its source;
 *  - facts about hosting, refresh rate and trials come from src/config/site.ts.
 */

const { facts } = site;
const radarPro = PLANS.starter.prices ? formatPrice(PLANS.starter.prices.month) : "";

export const landing = {
  hero: {
    eyebrow: "For UK suppliers to the public sector",
    title: "Know which public contracts are worth your time.",
    subtitle:
      "Upload a tender pack and get a straight answer: can we bid, and what would get us thrown out? Every pass/fail requirement, deadline and scored question is quoted from the buyer’s documents, with file and page. Your first check is free, and your radar is already built.",
    primaryCta: { label: "Find your company", href: "/find" },
    secondaryCta: { label: "Get a free bid check", href: "/free-bid-check" },
    sampleLink: { label: "See a sample check", href: "/sample-check" },
    note: "Free to start. No card needed.",
  },

  facts: [
    {
      title: "Official Find a Tender data",
      body: "Contract and award notices from the UK’s Find a Tender service, used under the Open Government Licence.",
    },
    {
      title: `Refreshed every ${facts.dataRefreshMinutes} minutes`,
      body: "New tenders and awards reach your radar the day they are published.",
    },
    {
      title: "Independent of government",
      body: "Bidfolio is a private service. It is not part of, or endorsed by, the UK Government.",
    },
  ],

  check: {
    eyebrow: "The cited bid check",
    title: "Can we bid — and what would get us thrown out?",
    lead: "Read the pack in minutes, not evenings. A bid takes a small firm about five days to prepare. The check tells you whether to start.",
    leadSource: "Five days per bid: Federation of Small Businesses, December 2025.",
    points: [
      {
        title: "Every requirement, quoted",
        body: "Insurance levels, turnover thresholds, accreditations, policies, experience. Each one shows the buyer’s exact words, the file and the page.",
      },
      {
        title: "Checked against your company",
        body: "Each requirement is marked Met, Gap or Verify against the facts you have confirmed. You see the gaps before you write a word.",
      },
      {
        title: "Gaps shown as gaps",
        body: "If a quote cannot be matched to the source text, it is marked “Verify in documents”. Nothing is filled in to look complete.",
      },
    ],
    detailsTitle: "From a sample check",
    disclaimer: "AI-assisted analysis. Check it against the tender documents: you remain responsible for your submission.",
    primaryCta: { label: "Get a free bid check", href: "/free-bid-check" },
    sampleLink: { label: "See a sample check", href: "/sample-check" },
  },

  radar: {
    eyebrow: "Your radar",
    title: "Your radar, already built.",
    lead: "We have read the award notices. If your company has won a public contract, its page is already here: open and free, with no sign-in to see it.",
    columns: [
      {
        title: "Open tenders like the ones you’ve won",
        body: "Matched on what you have delivered, not on keywords you had to guess. Each match says why it is there and when it closes.",
      },
      {
        title: "Contracts ending soon in your trade",
        body: "Who holds them, what they are worth and when they end. Usually the first sign that a tender is coming.",
      },
      {
        title: "Buyers who award without a tender in your trade",
        body: "About four in ten UK procedures are direct awards. See which buyers place work like yours directly, and introduce yourself before the next one.",
        source: "Direct awards: Open Contracting Partnership, on the first year of Procurement Act data.",
      },
    ],
    primaryCta: { label: "Find your company", href: "/find" },
    note: "No public contract yet? Create a free account and set up a radar by trade and region.",
  },

  drafts: {
    eyebrow: "Bid Desk",
    title: "Drafts built from your own evidence.",
    lead: "A generic answer scores low. Bidfolio drafts each scored question only from your company facts and the documents in your library: policies, case studies, past bids.",
    points: [
      { title: "Sources marked", body: "Every claim in a draft points to the document it came from." },
      { title: "Gaps marked, not invented", body: "Where your library has no evidence, the draft says “Evidence needed” and tells you what to add." },
      {
        title: "Read like an evaluator would",
        body: "Each answer is marked against the buyer’s own scoring guide, with the changes most likely to earn marks. A second read, not a score prediction.",
      },
      { title: "Word limits watched", body: "A live count against the limit. Export every answer to Word when you are done." },
    ],
  },

  howItWorks: {
    title: "How it works",
    lead: "Three steps. The first two are free.",
    steps: [
      {
        title: "Find your company",
        body: "Search by name or Companies House number. Your page shows your public contract wins and the tenders open now.",
        cta: { label: "Find your company", href: "/find" },
      },
      {
        title: "Claim your radar",
        body: "Create a free account to see every match, save tenders and get a weekly digest. No card needed.",
        cta: { label: "Create a free account", href: "/sign-up" },
      },
      {
        title: "Upload a tender pack",
        body: "PDF, Word, Excel or a zip. Your cited bid check is ready in a few minutes. The first one is free.",
        cta: { label: "Get a free bid check", href: "/free-bid-check" },
      },
    ],
  },

  straightAnswers: {
    title: "Straight answers",
    lead: "You are being asked to upload commercial documents to a service you have not used before. Here is what you should know first.",
    items: [
      {
        question: "Who runs Bidfolio?",
        answer: `One independent founder, based in ${facts.operatorCountry}. Not a government body, and not a bid consultancy.`,
      },
      {
        question: "Where are my files stored?",
        answer: `In ${facts.hostingRegion}. Only members of your workspace can open them.`,
      },
      {
        question: "Are my files used to train AI?",
        answer: "No. Your tender packs and library are used only to produce your results. Delete them at any time, or ask us to.",
      },
      {
        question: "Will a renewal surprise me?",
        answer: "No. We email you 7 days before an annual plan renews. Pause or cancel in two clicks from Settings.",
      },
      {
        question: "Who takes the payment?",
        answer: "Paddle, our merchant of record. Paddle handles cards, invoices and VAT.",
      },
      {
        question: "Is this an official service?",
        answer: "No. Bidfolio is independent. The data comes from the official Find a Tender service under the Open Government Licence.",
      },
    ],
  },

  pricingTeaser: {
    title: "Pay monthly, or by the bid.",
    lead: `Start free. The full radar is ${radarPro} a month. A ${BID_PASS.name} is ${BID_PASS.price} for one full bid, with no subscription.`,
    cta: { label: "Compare plans", href: "/pricing" },
  },

  faq: {
    title: "Questions people ask first",
    items: [
      {
        question: "Is Bidfolio an official government service?",
        answer:
          "No. Bidfolio is an independent, private service. It is not affiliated with, or endorsed by, the UK Government, the Cabinet Office or Find a Tender. You never need Bidfolio to see or respond to a public tender: the official notices are free.",
      },
      {
        question: "Where does the data come from?",
        answer: `From contract and award notices published on the UK Government’s Find a Tender service, licensed under the Open Government Licence v3.0. We fetch new notices every ${facts.dataRefreshMinutes} minutes. Public pages show company-level information only: no names, email addresses or phone numbers of individuals.`,
      },
      {
        question: "Is my tender pack kept private?",
        answer: `Yes. Files you upload are your confidential data. Only members of your workspace can open them. They are stored in ${facts.hostingRegion}, are never used to train AI models, and are deleted when you delete them or ask us to.`,
      },
      {
        question: "Does AI write my bid?",
        answer:
          "It writes first drafts, only from your own evidence, and you stay in control. Where your library has no evidence for a claim, the draft says “Evidence needed” instead of making something up. You edit, decide and submit, and you remain responsible for your submission.",
      },
      {
        question: "Do buyers allow AI-assisted bids?",
        answer:
          "Most tender packs do not forbid it, and UK guidance (PPN 017) lets buyers ask suppliers to disclose it. Our advice: disclose when asked, and keep every statement accurate. The buyer’s instructions always come first, so check your pack.",
      },
      {
        question: "My company has not won a public contract yet. Can I still use Bidfolio?",
        answer:
          "Yes. Create a free account and set up a radar by trade, region and contract value. The cited bid check works on any tender pack, whether or not you have won before.",
      },
      {
        question: "Can I cancel any time?",
        answer: `Yes. Pause or cancel in two clicks from Settings. You keep what you paid for until the end of the period, and your data stays. If you change your mind within ${site.legal.refundWindowDays} days of your first payment, ask for a refund.`,
      },
      {
        question: "Which parts of the UK are covered?",
        answer:
          "UK-wide notices published on Find a Tender. Notices that appear only on other portals, such as Contracts Finder, Public Contracts Scotland, Sell2Wales or eTendersNI, are not included yet.",
      },
    ],
  },

  finalCta: {
    title: "See what the public record says about your company.",
    lead: "Your page is free and already built. Finding it takes about 30 seconds.",
    primaryCta: { label: "Find your company", href: "/find" },
    secondaryCta: { label: "Get a free bid check", href: "/free-bid-check" },
  },
} as const;
