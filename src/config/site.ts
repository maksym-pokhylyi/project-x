/**
 * The ONE place to rename the product.
 *
 * Everything user-facing (metadata, emails, legal pages, footer) reads from here.
 * Values in [[DOUBLE_BRACKETS]] are placeholders that MUST be replaced before launch;
 * they are rendered highlighted on the legal pages and listed in docs/legal/TODO.md.
 */
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
  supportEmail: "support@bidfolio.co.uk",
  /** Shown as the sender name; the address comes from EMAIL_FROM. */
  emailFromName: "Bidfolio",
  locale: "en-GB",
  social: {
    x: "",
    linkedin: "",
    github: "",
  },
  /** Seller-of-record details for the legal pages and the footer. */
  company: {
    legalName: "[[COMPANY_LEGAL_NAME]]",
    address: "[[COMPANY_REGISTERED_ADDRESS]]",
    country: "[[COMPANY_COUNTRY]]",
    registrationNumber: "[[COMPANY_REGISTRATION_NUMBER]]",
    taxId: "[[COMPANY_TAX_ID]]",
    governingLaw: "[[GOVERNING_LAW_JURISDICTION]]",
    privacyContactEmail: "[[PRIVACY_CONTACT_EMAIL]]",
    /** Article 27 UK GDPR representative; must be appointed before any outreach. */
    ukRepresentative: "[[UK REPRESENTATIVE NAME AND ADDRESS]]",
    /** ICO data-protection fee registration reference. */
    icoRegistrationNumber: "[[ICO_REGISTRATION_NUMBER]]",
  },
  legal: {
    /** ISO date shown as "Last updated" on every legal page. */
    lastUpdated: "2026-11-13",
    /** Days during which a first payment can be refunded on request. */
    refundWindowDays: 14,
  },
  /** Facts the marketing and legal copy rely on. Change them here, not in the pages. */
  facts: {
    /** How often new notices are fetched from Find a Tender. */
    dataRefreshMinutes: 10,
    /** Where application data and uploaded files are stored. */
    hostingRegion: "the EU (Frankfurt, Germany)",
    /** Where the operator is based. */
    operatorCountry: "Ukraine",
    /** Days a Bid Desk trial lasts (card required). */
    trialDays: 14,
    /** Days after which outreach contacts that never replied are deleted. */
    outreachRetentionDays: 90,
  },
} as const;

export type Site = typeof site;
