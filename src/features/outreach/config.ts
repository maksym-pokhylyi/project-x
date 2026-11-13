import { site } from "@/config/site";

/**
 * Settings of the founder's outreach tooling. Read on the server only.
 *
 * The rules behind the numbers are in docs/research/round2/P2-outreach-legal-deliverability.md
 * (P2), docs/gtm/02-outreach-kit.md and docs/research/DECISION.md §6. Change a number here,
 * not in the code that uses it.
 *
 * SENDER IDENTITY. Every letter must say who is writing (PECR reg. 23(a)); the CSV export
 * is refused until the details below are real. They come from `site.company`
 * (src/config/site.ts) where the site already knows them, and each can be set per
 * deployment with an environment variable (all optional, none of them secret):
 *
 *   OUTREACH_SENDER_FIRST_NAME          "Jane"                — closes the letter
 *   OUTREACH_SENDER_FULL_NAME           "Jane Doe"            — first line of the signature
 *   OUTREACH_SENDER_CONTACT_EMAIL       a mailbox that is read every day
 *   OUTREACH_SENDER_LEGAL_NAME          default: site.company.legalName
 *   OUTREACH_SENDER_REGISTER_REFERENCE  default: site.company.registrationNumber (optional line)
 *   OUTREACH_SENDER_POSTAL_ADDRESS      default: site.company.address
 *   OUTREACH_UK_REPRESENTATIVE          name and UK address; REQUIRED before a named address is exported
 *   OUTREACH_ICO_NUMBER                 optional line
 */

/** A value that is missing or still a `[[PLACEHOLDER]]` from src/config/site.ts. */
function real(value: string | undefined | null): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed && !trimmed.includes("[[") ? trimmed : null;
}

/** `site.company` gains fields in other branches (UK representative, ICO number): read them if they are there. */
const company = site.company as Readonly<Record<string, string | undefined>>;

export type OutreachSender = {
  firstName: string | null;
  fullName: string | null;
  legalName: string | null;
  registerReference: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  ukRepresentative: string | null;
  icoNumber: string | null;
};

export function outreachSender(env: Readonly<Record<string, string | undefined>> = process.env): OutreachSender {
  return {
    firstName: real(env.OUTREACH_SENDER_FIRST_NAME),
    fullName: real(env.OUTREACH_SENDER_FULL_NAME),
    legalName: real(env.OUTREACH_SENDER_LEGAL_NAME) ?? real(company.legalName),
    registerReference: real(env.OUTREACH_SENDER_REGISTER_REFERENCE) ?? real(company.registrationNumber),
    postalAddress: real(env.OUTREACH_SENDER_POSTAL_ADDRESS) ?? real(company.address),
    contactEmail: real(env.OUTREACH_SENDER_CONTACT_EMAIL),
    ukRepresentative: real(env.OUTREACH_UK_REPRESENTATIVE) ?? real(company.ukRepresentative),
    icoNumber: real(env.OUTREACH_ICO_NUMBER) ?? real(company.icoRegistrationNumber),
  };
}

export type SenderProblem = { field: keyof OutreachSender; label: string; envVar: string };

const REQUIRED: SenderProblem[] = [
  { field: "firstName", label: "Your first name (closes the letter)", envVar: "OUTREACH_SENDER_FIRST_NAME" },
  { field: "fullName", label: "Your full name (first line of the signature)", envVar: "OUTREACH_SENDER_FULL_NAME" },
  { field: "legalName", label: "Full legal name of the operator", envVar: "OUTREACH_SENDER_LEGAL_NAME" },
  { field: "postalAddress", label: "Postal address where post is received", envVar: "OUTREACH_SENDER_POSTAL_ADDRESS" },
  { field: "contactEmail", label: "A contact e-mail address that is read every day", envVar: "OUTREACH_SENDER_CONTACT_EMAIL" },
];
const REQUIRED_FOR_NAMED: SenderProblem = {
  field: "ukRepresentative",
  label: "UK data-protection representative (name and UK address) — needed before any named address is written to",
  envVar: "OUTREACH_UK_REPRESENTATIVE",
};

/**
 * What is still missing before letters may be exported. A list that contains named
 * (personal-data) addresses also needs the UK representative: P2 §3.2, UK GDPR Art. 14(1)(a).
 */
export function senderProblems(sender: OutreachSender, options: { includesNamed: boolean }): SenderProblem[] {
  const needed = options.includesNamed ? [...REQUIRED, REQUIRED_FOR_NAMED] : REQUIRED;
  return needed.filter((item) => !sender[item.field]);
}

export const outreachConfig = {
  /** An address (and its company) is not listed again for this many days after it was last listed or written to. */
  coolOffDays: 180,
  batchSize: { default: 100, max: 400 },
  publishedWithinDays: { default: 30, max: 180 },
  /** Most candidate addresses one preview will rank; a segment wider than this is cut to its newest awards. */
  maxCandidates: 20_000,
  /** Notice types whose supplier contact may be used: award decisions (UK6) and contract details (UK7). See 02-outreach-kit §1. */
  noticeTypes: ["UK6", "UK7"] as readonly string[],
  /** Letter family used by new campaigns. */
  defaultTemplateKey: "award_page_v1",
  /**
   * The falsification test of docs/research/DECISION.md §6: of 400 e-mails, seven days after
   * the last one. PASS needs every pass figure (packs OR card payments); KILL is either kill figure.
   */
  experiment: {
    emails: 400,
    judgeAfterDays: 7,
    pass: { visits: 30, claims: 10, packs: 3, cardPayments: 2 },
    kill: { visitsBelow: 12, claimsAtMost: 0 },
    /** More complaints than this stops the test whatever the other figures say. */
    maxComplaints: 2,
  },
  /** Below this many e-mails, results are shown as counts only: a percentage of a handful is noise. */
  percentagesFrom: 100,
  /** E-mails per mailbox per day: where to start and where to stop (P2 §6.4, §6.7). */
  dailyVolumePerMailbox: { start: 10, max: 30 },
  /** Section of the privacy notice written for people we e-mailed (Art. 14). */
  privacyNoticePath: "/legal/privacy#contacted",
  /** Where the founder's own procedures live. */
  docs: {
    base: "https://github.com/maksym-pokhylyi/project-x/blob/main/",
    kit: "docs/gtm/02-outreach-kit.md",
    compliance: "docs/gtm/07-compliance-pack.md",
    legal: "docs/research/round2/P2-outreach-legal-deliverability.md",
    plan: "docs/gtm/05-first-30-days.md",
  },
} as const;

/** Rate limits of the public opt-out page, per client address. */
export const OPTOUT_RATE_LIMITS = {
  /** Pressing the button of a personal link. Generous: it must never get in a recipient's way. */
  link: { limit: 30, windowSeconds: 3600 },
  /** Typing an address into the form: anyone can do it for any address. */
  form: { limit: 5, windowSeconds: 3600 },
  /** "Hide my page" / "delete my details" requests. */
  followUp: { limit: 10, windowSeconds: 3600 },
} as const;
