import { operatorAddress, site } from "@/config/site";

/**
 * Settings of the founder's outreach tooling. Read on the server only.
 *
 * The rules behind the numbers are in docs/research/round2/P2-outreach-legal-deliverability.md
 * (P2), docs/gtm/02-outreach-kit.md and docs/research/DECISION.md §6. Change a number here,
 * not in the code that uses it.
 */

/**
 * WHO IS WRITING — the seller identity the owner confirmed on 13 November 2026
 * (docs/OWNER_ACTIONS.md, item C). Every letter and the opt-out page state it
 * (PECR reg. 23(a): the sender's identity must not be concealed).
 *
 * The values live in ONE place, `site.operator` in src/config/site.ts (with the site
 * footer, the legal pages and every e-mail footer); this is only the shape the outreach
 * module reads them in. Nothing else in the module holds them.
 */
const OPERATOR = {
  /** The person behind the brand: signs the letter and heads its signature. */
  name: site.operator.name,
  /** As registered. */
  legalName: site.operator.legalName,
  /** What he is, in the words agreed for letters and public pages. */
  description: `an independent ${site.operator.legalForm} registered in ${site.operator.address.country}`,
  /** Named in the one-line footer, where the full address would be too long. */
  town: site.operator.address.city,
  /** Where post is received. */
  address: operatorAddress,
  /** A mailbox that is read every day. */
  contactEmail: site.supportEmail,
} as const;

/** A value that is missing (null in src/config/site.ts while it is pending) or still a `[[PLACEHOLDER]]`. */
function real(value: string | undefined | null): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed && !trimmed.includes("[[") ? trimmed : null;
}

export type OutreachSender = {
  /** Closes the letter. */
  firstName: string | null;
  /** First line of the signature. */
  fullName: string | null;
  legalName: string | null;
  /** "an independent sole trader registered in Ukraine" */
  description: string | null;
  postalAddress: string | null;
  contactEmail: string | null;
  /** UK GDPR Art. 27 representative, name and UK address. Null until one is appointed. */
  ukRepresentative: string | null;
  icoNumber: string | null;
};

/**
 * The identity block of a letter. The operator comes from OPERATOR above; the UK
 * representative and the ICO number come from `site.operator`, where they are null while
 * pending — and then neither is named in a letter.
 */
export function outreachSender(): OutreachSender {
  const fullName = real(OPERATOR.name);
  return {
    firstName: fullName?.split(" ")[0] ?? null,
    fullName,
    legalName: real(OPERATOR.legalName),
    description: real(OPERATOR.description),
    postalAddress: real(OPERATOR.address),
    contactEmail: real(OPERATOR.contactEmail),
    ukRepresentative: real(site.operator.ukRepresentative),
    icoNumber: real(site.operator.icoRegistrationNumber),
  };
}

/**
 * The small print under a public page of this module, in the wording agreed for every legal
 * footer: who operates the service, how to reach him, and the UK representative — named
 * once there is one, "being appointed" until then.
 */
export function operatorFooterLine(sender: OutreachSender = outreachSender()): string {
  const where = real(OPERATOR.town) ? ` (${OPERATOR.town})` : "";
  return [
    `${site.name} is operated by ${sender.fullName}, ${sender.description}${where}. Contact: ${sender.contactEmail}`,
    `UK representative: ${sender.ukRepresentative ?? "being appointed"}`,
  ].join(" · ");
}

/**
 * Has a UK representative been appointed (UK GDPR Art. 27)? Until then an address that
 * identifies a person must not be written to — P2 §3.2: "appoint a UK representative before
 * the first email to a named person". The builder then lists generic mailboxes only.
 */
export function ukRepresentativeAppointed(sender: OutreachSender = outreachSender()): boolean {
  return sender.ukRepresentative !== null;
}

/** The blocking notice of the builder, and what the server answers when a named address is asked for without a representative. */
export const NAMED_ADDRESSES_BLOCKED = "Do not send to named addresses until a UK representative is appointed";

export type SenderProblem = { field: keyof OutreachSender; label: string; where: string };

const REQUIRED: SenderProblem[] = [
  { field: "fullName", label: "The operator’s full name", where: "site.operator in src/config/site.ts" },
  { field: "legalName", label: "The operator’s registered name", where: "site.operator in src/config/site.ts" },
  { field: "postalAddress", label: "A postal address where post is received", where: "site.operator in src/config/site.ts" },
  { field: "contactEmail", label: "A contact address that is read every day", where: "site.operator in src/config/site.ts" },
];
const REQUIRED_FOR_NAMED: SenderProblem = {
  field: "ukRepresentative",
  label: "A UK data-protection representative (name and UK address)",
  where: "site.operator.ukRepresentative in src/config/site.ts",
};

/**
 * What is still missing before letters may be exported. A list that contains named
 * (personal-data) addresses also needs the UK representative: UK GDPR Art. 14(1)(a).
 */
export function senderProblems(sender: OutreachSender, options: { includesNamed: boolean }): SenderProblem[] {
  const needed = options.includesNamed ? [...REQUIRED, REQUIRED_FOR_NAMED] : REQUIRED;
  return needed.filter((item) => !sender[item.field]);
}

/** Where someone asks for a page to be corrected or hidden, or their details removed (the "Flag a mistake" form). */
export function requestFormHref(pagePath?: string): string {
  return pagePath ? `/about-the-data?page=${encodeURIComponent(pagePath)}#request` : "/about-the-data#request";
}

export const outreachConfig = {
  /** An address (and its company) is not listed again for this many days after it was last listed or written to. */
  coolOffDays: 180,
  batchSize: { default: 100, max: 400 },
  publishedWithinDays: { default: 30, max: 180 },
  /** Most candidate rows one preview will rank; a segment wider than this is cut to its newest awards. */
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
} as const;
