import { billingCopy } from "./billing-copy";
import { site } from "./site";

/**
 * ALL copy of the landing page ("/"), in one place so it can be edited without touching
 * components. The page follows the designer's revised artboards
 * (docs/design/handoff/Landing-1440 and Landing-390) and the lead's reply to the designer
 * (REPLY-to-designer.md): Find a Tender only, the final plans, "cited bid check" as the name
 * of the first deliverable, and no score prediction.
 *
 * Voice: plain British English, second person, short sentences, numbers before adjectives,
 * the buyer's words (tender, bid, buyer, contract, award).
 *
 * Rules that are easy to break:
 *  - never promise wins, win rates, "100% compliant" or a predicted score;
 *  - facts about hosting and refunds come from src/config/site.ts, plans and prices from
 *    src/config/plans.ts, sentences about billing from src/config/billing-copy.ts;
 *  - `…Short` variants are what the 390 px artboard says in fewer words;
 *  - all companies, buyers and figures in the product pictures are fictional samples.
 */

const { facts } = site;

export const landing = {
  hero: {
    eyebrow: "The bid desk for small suppliers",
    titleLead: "Know which public contracts are worth your time",
    titleRest: "and get a compliant first draft in hours, not days.",
    lead: "Bidfolio builds a free page and radar for your company from notices published on Find a Tender: your wins, open tenders like them, and rival contracts about to end. When one looks right, upload the tender pack for a cited bid check, then draft your answers from your own documents.",
    leadShort:
      "Bidfolio builds a free page and radar for your company from notices published on Find a Tender. When a tender looks right, upload the pack for a cited bid check, then draft your answers from your own documents.",
    note: "No account needed to look.",
    noteShort: "No account needed.",
    sampleLink: { before: "Or ", label: "see a sample check", href: "/sample-check" },
  },

  /** The company search that opens a supplier page. Sends ?q= to /find. */
  search: {
    label: "Find your company’s page. It’s free.",
    placeholder: "Company name or Companies House number",
    placeholderShort: "Company name or number",
    submit: "Find my company",
    action: "/find",
  },

  strip: {
    data: {
      strong: "Built from open data.",
      text: "Tender, award and contract notices from Find a Tender, used under the Open Government Licence v3.0.",
    },
    independent: {
      strong: "Independent.",
      text: "Not a government service.",
      link: { label: "Read the note", href: "#independence" },
    },
  },

  how: {
    eyebrow: "How it works",
    title: "From published notice to first draft in three steps",
    steps: [
      {
        title: "Find your company",
        body: "Type your company name. Your page and radar are already built from notices on Find a Tender: the contracts you have won, open tenders like them, rival contracts ending soon and the buyers in your trade. No wins yet? Set up a radar by trade and region.",
      },
      {
        title: "Run a cited bid check",
        body: "Upload the tender pack as the buyer sent it. Every requirement comes back quoted word for word and cited to its file and page, checked against your company, with a plain verdict on whether you can comply. Your first check is free.",
      },
      {
        title: "Draft, mark, improve",
        body: "Take it on to a full bid: the scored questions in one matrix, a first draft of each answer written only from documents you have uploaded, and each draft marked against the buyer’s own scoring scheme, so you know what to fix before you submit.",
      },
    ],
  },

  proof: {
    eyebrow: "Inside a cited bid check",
    title: "Every requirement, quoted and cited",
    lead: "No summaries to take on trust. Each line in a check is the buyer’s own sentence, with the file and page it came from, so you can check it in seconds.",
    leadShort: "No summaries to take on trust. Each line in a check is the buyer’s own sentence, with the file and page it came from.",
    bridge: "appears in your check as",
    points: [
      {
        title: "Quoted, not paraphrased",
        body: "The requirement is the buyer’s sentence, copied exactly. If the pack says “must”, your check says “must”.",
      },
      {
        title: "File, page and clause on every line",
        body: "Each reference is marked verified, check or unverified, so you know which ones to read for yourself.",
      },
      {
        title: "Gaps shown as gaps",
        body: "Each requirement is checked against the documents you have uploaded. Where there is no evidence, the check says so.",
      },
    ],
    cta: { label: "Get a free cited bid check", href: "/free-bid-check" },
    sampleLink: { label: "See a sample check", href: "/sample-check" },
  },

  pricing: {
    eyebrow: "Pricing",
    title: "Free to look. Pay when you bid.",
    lead: "Your page, your radar and your first cited bid check cost nothing. Subscribe if you bid often, or buy a single Bid Pass if you don’t.",
    smallPrint: `${billingCopy.vat} ${billingCopy.annual}`,
    compare: { label: "Compare the plans in full", href: "/pricing" },
  },

  /** Answers as agreed in docs/design/handoff/REPLY-to-designer.md. Plain text: also sent as FAQPage structured data. */
  questions: {
    eyebrow: "Questions",
    title: "What suppliers ask first",
    contact: { before: "Something else? Write to ", after: "." },
    items: [
      {
        question: "Is this an official government service?",
        answer:
          "No. Bidfolio is an independent service. It is not affiliated with, or endorsed by, the UK Government. The notices come from the Find a Tender service and are reused under the Open Government Licence v3.0.",
      },
      {
        question: "Where are my documents kept, and who can see them?",
        answer: `Your tender packs and company documents are stored in ${facts.hostingRegionShort} and encrypted in transit and at rest. Only people in your workspace can open them. They are never used to train AI models: we send them to AI providers only under zero-data-retention terms, so providers do not keep them after answering. You can delete a bid, a document or your whole workspace at any time, and the files are removed from our storage.`,
      },
      {
        question: "Does AI write my bid?",
        answer:
          "It writes a first draft using only the documents you upload, shows where every claim comes from, and marks gaps instead of filling them. You edit, decide and submit. If a buyer asks whether AI was used, say so — public buyers allow AI-assisted bids.",
      },
      {
        question: "How do I cancel?",
        answer: `${billingCopy.pauseOrCancel} ${billingCopy.keepAccess} ${billingCopy.renewalReminder} ${billingCopy.refund}`,
      },
      {
        question: "My company has not won a public contract yet.",
        answer: "You can still set up a radar by choosing your trades and regions, and run a cited bid check on any tender pack.",
      },
      {
        question: "Which parts of the UK are covered?",
        answer: "UK-wide notices published on Find a Tender.",
      },
    ],
  },

  finalCta: {
    title: "See what the notices already say about your company.",
  },

  independence: {
    title: "Bidfolio is independent.",
    paragraphs: [
      "Bidfolio is an independent service. It is not affiliated with, or endorsed by, the UK Government. The notices come from the Find a Tender service and are reused under the Open Government Licence v3.0.",
      "Notices can be late, incomplete or wrong, so always check the original notice and the tender documents before you bid.",
    ],
  },
} as const;
