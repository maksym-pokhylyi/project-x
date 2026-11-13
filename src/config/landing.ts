import { BID_PASS } from "./plan-display";
import { site } from "./site";

/**
 * ALL copy of the landing page ("/"), in one place so it can be edited without touching
 * components. The page follows the designer's artboards (docs/design/handoff/Landing-*),
 * with the corrections from the handoff README applied: Find a Tender only, the real plans
 * and prices, "cited bid check" as the name of the first deliverable, and no score prediction.
 *
 * Voice: plain British English, second person, short sentences, numbers before adjectives,
 * the buyer's words (tender, bid, buyer, contract, award).
 *
 * Rules that are easy to break:
 *  - never promise wins, win rates, "100% compliant" or a predicted score;
 *  - facts about hosting, refresh rate and trials come from src/config/site.ts;
 *  - all companies, buyers and figures in the product pictures are fictional samples.
 */

const { facts } = site;

export const landing = {
  hero: {
    eyebrow: "The bid desk for small suppliers",
    titleLead: "Know which public contracts are worth your time",
    titleRest: "and get a compliant first draft in hours, not days.",
    lead: "Bidfolio builds a free page for your company from published procurement notices: your wins, open tenders like them, and rival contracts about to end. When you decide to bid, upload the tender pack and get every requirement quoted and cited, with first-draft answers written only from your own documents.",
    /** The same promise in fewer words, for phones (as in the 390 px artboard). */
    leadShort:
      "Bidfolio builds a free page for your company from published procurement notices. When you bid, upload the tender pack and get every requirement quoted and cited, with first-draft answers written only from your own documents.",
    note: "No account needed to look.",
    sampleLink: { before: "Or ", label: "see a sample bid check", href: "/sample-check" },
  },

  /** The company search that opens a supplier page. Sends ?q= to /find. */
  search: {
    label: "Find your company’s page. It’s free.",
    placeholder: "Company name or Companies House number",
    placeholderShort: "Company name or number",
    submit: "Show my page",
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
      link: { label: "How we relate to GOV.UK", href: "#independence" },
    },
  },

  how: {
    eyebrow: "How it works",
    title: "From published notice to first draft in three steps",
    steps: [
      {
        title: "Find your page",
        body: "Type your company name. Your page is already built from published notices: the contracts you have won, open tenders like them, rival contracts ending soon and the buyers in your trade. It is free and needs no account.",
      },
      {
        title: "Upload the tender pack",
        body: "Drop in the documents as the buyer sent them. You get a cited bid check: every requirement quoted word for word and cited to its file and page, the scored questions with weightings and word limits, and a plain verdict on whether you can comply.",
      },
      {
        title: "Draft, mark, improve",
        body: "Each answer gets a first draft written only from documents you have uploaded: policies, certificates, case studies, past bids. Every draft is then marked the way an evaluator would mark it, against the buyer’s own scoring scheme, so you know what to fix before you submit.",
      },
    ],
  },

  proof: {
    eyebrow: "Inside a cited bid check",
    title: "Every requirement, quoted and cited",
    lead: "No summaries to take on trust. Each line in a check is the buyer’s own sentence, with the file and page it came from, so you can verify it in seconds.",
    bridge: "appears in your check as",
    points: [
      {
        title: "Quoted, not paraphrased",
        body: "The requirement is the buyer’s sentence, copied exactly. If the pack says “must”, your check says “must”.",
        short: "The buyer’s sentence, copied exactly.",
      },
      {
        title: "File, page and clause on every line",
        body: "Open the source at the right page and read the sentence in context before you rely on it.",
        short: "Check the source in seconds.",
      },
      {
        title: "Gaps shown as gaps",
        body: "Each requirement is checked against the documents you have uploaded. Where there is no evidence, the check says so.",
        short: "No evidence in your documents? It says so.",
      },
    ],
    sampleLink: { label: "See a whole sample check", href: "/sample-check" },
    note: "Your first cited bid check is free.",
  },

  pricing: {
    eyebrow: "Pricing",
    title: "Free to look. Pay when you bid.",
    lead: "Your page costs nothing. Add alerts when you want to hear first, and the bid desk when there is a tender on your table.",
    smallPrint: `Prices in pounds sterling, excluding VAT. Annual billing gives two months free. Bid Desk starts with a ${facts.trialDays}-day trial. Pause or cancel in two clicks.`,
    compare: { label: "Compare the plans in full", href: "/pricing" },
  },

  bidPass: {
    eyebrow: "One tender, no subscription",
    title: BID_PASS.name,
    body: "One full bid, paid once: the cited bid check, the scored questions, first-draft answers from your own documents, evaluator-style marking and export to Word. Works on any plan, including Free.",
    cta: { label: "Start a bid with a Bid Pass", href: "/sign-up?next=/app/bids/new" },
    note: BID_PASS.footnote,
  },

  straightAnswers: {
    eyebrow: "Before you upload anything",
    title: "Straight answers",
    lead: "You are being asked to trust a service you have not used with commercial documents. Here is what you should know first.",
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
        answer: "No. Your tender packs and documents are used only to produce your own results. Delete them at any time, or ask us to.",
      },
      {
        question: "What will it not do?",
        answer: "Price your bid, submit it, or forecast the buyer’s score. It reads the pack, drafts from your evidence and marks against the scheme. The decisions stay with you.",
      },
      {
        question: "Will a renewal surprise me?",
        answer: "No. We email you 7 days before an annual plan renews. Pause or cancel in two clicks from Settings.",
      },
      {
        question: "Who takes the payment?",
        answer: "Paddle, our merchant of record. Paddle handles cards, invoices and VAT.",
      },
    ],
  },

  questions: {
    eyebrow: "Questions",
    title: "What suppliers ask first",
    contact: { before: "Something else? Write to ", after: ". A person replies." },
    items: [
      {
        question: "Where does the information on my page come from?",
        answer: `From notices that UK public bodies publish openly: tender, award and contract notices on Find a Tender, fetched every ${facts.dataRefreshMinutes} minutes. We match them to your company by name and Companies House number. Notices that appear only on other portals, such as Contracts Finder, Public Contracts Scotland or Sell2Wales, are not included yet. If a notice is wrong or missing, you can flag it from your page.`,
      },
      {
        question: "Is Bidfolio part of GOV.UK?",
        answer:
          "No. Bidfolio is an independent company. We use public notices under the Open Government Licence and have no connection to the Cabinet Office or Find a Tender. You still submit your bid through the buyer’s own portal.",
      },
      {
        question: "Will the drafts invent things about my company?",
        answer:
          "No. Drafts are written only from documents you upload, and each claim carries a marker back to the document and page it came from. Where your documents do not support a point the question asks for, the draft leaves a labelled gap for you to fill instead of guessing.",
      },
      {
        question: "Does it write the whole bid for me?",
        answer: "It gives you a compliant first draft and an honest mark. Pricing, the final wording and the decision to submit stay with you.",
      },
      {
        question: "What happens to the documents I upload?",
        answer: `Your tender packs and company documents stay in your workspace and are used only to produce your checks and drafts. They are stored in ${facts.hostingRegion}, are never used to train AI models, and are deleted when you delete them or ask us to.`,
      },
      {
        question: "Can I cancel when the bid is in?",
        answer: `Yes. Pause or cancel in two clicks from Settings. You keep what you paid for until the end of the period, and your page and documents stay. If you change your mind within ${site.legal.refundWindowDays} days of your first payment, ask for a refund. If you only have one tender, a ${BID_PASS.name} is ${BID_PASS.price} with no subscription.`,
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
    ],
  },

  finalCta: {
    title: "See what the notices already say about your company.",
  },

  independence: {
    title: "Bidfolio is independent.",
    paragraphs: [
      "Bidfolio is a private company. It is not part of GOV.UK, and it is not endorsed by or connected to the Cabinet Office, Find a Tender or any contracting authority.",
      "Pages are built from published notices and contain public sector information licensed under the Open Government Licence v3.0. Notices can be late, incomplete or wrong, so always check the original notice and the tender documents before you bid.",
    ],
  },
} as const;
