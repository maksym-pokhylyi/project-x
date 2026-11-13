/**
 * The ONE place to rename the product and to state who runs it.
 *
 * Everything user-facing (metadata, emails, legal pages, footer) reads from here.
 * A detail that is still pending is `null` (see `operator`) and every page renders an honest
 * line for it, never a made-up value. Wording that a lawyer or the founder still has to
 * confirm is marked [[LIKE_THIS]] in the legal pages; both kinds are listed in
 * docs/legal/TODO.md.
 */

/** Where the operator is registered and works from. */
const OPERATOR_COUNTRY = "Ukraine";
/** The one public address: questions, billing, privacy requests. E-mail is sent from it too. */
const CONTACT_EMAIL = "hello@bidfolio.co.uk";

export const site = {
  /** Product name, used in titles, emails and the app shell. */
  name: "Bidfolio",
  /** Brand line (footer, metadata). */
  tagline: "The bid desk for small suppliers",
  /** Meta description of the landing page and the default for every other page. */
  description:
    "Bidfolio reads a tender pack and tells you whether you can bid and what would get you thrown out, with every requirement quoted from the buyer's documents. Plus a free radar built from your own public contract wins.",
  /** Bare production domain, no protocol. Used in legal pages and e-mail footers. */
  domain: "bidfolio.co.uk",
  supportEmail: CONTACT_EMAIL,
  /** Shown as the sender name; the address comes from EMAIL_FROM. */
  emailFromName: "Bidfolio",
  locale: "en-GB",
  social: {
    x: "",
    linkedin: "",
    github: "",
  },
  /**
   * Who operates the service: the seller, the data controller and the party to the terms.
   * Supplied by the owner (13 Nov 2026). The footer and the e-mail frame use `name`; the
   * full legal name and the postal address appear on Contact, the Terms, the privacy notice
   * and the refund policy only.
   */
  operator: {
    /** Short name, for running text and the footer line. */
    name: "Maksym Pokhylyi",
    /** Legal name: a sole trader (FOP) as registered in Ukraine. */
    legalName: "FOP Pokhylyi Maksym Ihorovych",
    /** The legal name as it stands in the Ukrainian register. */
    legalNameLocal: "ФОП Похилий Максим Ігорович",
    /** Legal form, in plain words. */
    legalForm: "sole trader",
    /** Registered address. */
    address: {
      line1: "14 Stoliarnyi Lane (provulok Stoliarnyi)",
      city: "Kremenchuk",
      region: "Poltava Oblast",
      country: OPERATOR_COUNTRY,
    },
    /** Where privacy requests and complaints go: a mailbox that is read. */
    privacyEmail: CONTACT_EMAIL,
    /** State-register record number. Not displayed unless a value is given here. */
    registrationNumber: null as string | null,
    /**
     * PENDING. Representative in the United Kingdom under Article 27 UK GDPR: name and
     * postal address, from the signed mandate. Must be appointed before any outreach.
     * While null, pages say "being appointed" and point to the contact address.
     */
    ukRepresentative: null as string | null,
    /**
     * PENDING. ICO data-protection fee registration reference. While null, the privacy
     * notice says nothing about registration.
     */
    icoRegistrationNumber: null as string | null,
  },
  legal: {
    /** ISO date shown as "Last updated" on every legal page. */
    lastUpdated: "2026-11-13",
    /** Days during which a first payment can be refunded on request. */
    refundWindowDays: 14,
    /** PENDING, for the lawyer: the law and courts that govern the terms (terms §14). */
    governingLaw: "[[GOVERNING_LAW_JURISDICTION]]",
  },
  /** Facts the marketing and legal copy rely on. Change them here, not in the pages. */
  facts: {
    /** How often new notices are fetched from Find a Tender. */
    dataRefreshMinutes: 10,
    /** Where application data and uploaded files are stored. */
    hostingRegion: "the EU (Frankfurt, Germany)",
    /** The same, as marketing copy and the sign-up page put it. */
    hostingRegionShort: "the EU (Frankfurt)",
    /** Where the operator is based. */
    operatorCountry: OPERATOR_COUNTRY,
    /** Days a Bid Desk trial lasts (card required). */
    trialDays: 14,
    /** Days before an annual renewal on which the reminder email goes out. */
    renewalReminderDays: 7,
    /** Days after which outreach contacts that never replied are deleted. */
    outreachRetentionDays: 90,
  },
} as const;

export type Site = typeof site;

const { operator } = site;

/** The operator's registered address on one line. */
export const operatorAddress = [operator.address.line1, operator.address.city, operator.address.region, operator.address.country].join(", ");

/** "FOP Pokhylyi Maksym Ihorovych (ФОП Похилий Максим Ігорович)": the legal name with its original spelling. */
export const operatorLegalName = `${operator.legalName} (${operator.legalNameLocal})`;

/** What a page says about the UK representative: the appointed one, or that one is being appointed. */
export const ukRepresentativeLine = operator.ukRepresentative
  ? `UK representative: ${operator.ukRepresentative}`
  : `UK representative: being appointed — contact ${site.supportEmail}`;

export const OGL_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
export const OGL_NAME = "Open Government Licence v3.0";

/**
 * The identity line under every public page and in every e-mail, as separate statements so
 * that each surface can join and link them in its own way (the footer joins them with " · "
 * after the first sentence). No postal address here: that belongs to Contact and the legal
 * pages.
 */
export const identity = {
  operator: `${site.name} is operated by ${operator.name}, an independent ${operator.legalForm} registered in ${operator.address.country} (${operator.address.city}).`,
  contact: { label: "Contact:", email: site.supportEmail },
  /** In a line that already gives the contact address, the pending state needs no second one. */
  ukRepresentative: `UK representative: ${operator.ukRepresentative ?? "being appointed"}`,
  payments: "Payments are processed by Paddle.",
  licence: { before: "Contains public sector information licensed under the ", name: OGL_NAME, url: OGL_URL, after: "." },
  independence: `${site.name} is an independent service and is not affiliated with, or endorsed by, the UK Government.`,
} as const;

/** The same line as plain text, for the text part of e-mails and for tests. */
export const identityText = [
  `${identity.operator} ${identity.contact.label} ${identity.contact.email}`,
  identity.ukRepresentative,
  identity.payments,
  `${identity.licence.before}${identity.licence.name}${identity.licence.after}`,
  identity.independence,
].join(" · ");

/** Details of the operator that are still pending. Empty once everything is supplied. */
export function pendingOperatorDetails(): ("ukRepresentative" | "icoRegistrationNumber")[] {
  const pending: ("ukRepresentative" | "icoRegistrationNumber")[] = [];
  if (!operator.ukRepresentative) pending.push("ukRepresentative");
  if (!operator.icoRegistrationNumber) pending.push("icoRegistrationNumber");
  return pending;
}
