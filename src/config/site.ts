/**
 * The ONE place to rename the product.
 *
 * Everything user-facing (metadata, emails, legal pages, footer) reads from here.
 * Values in [[DOUBLE_BRACKETS]] are placeholders that MUST be replaced before launch;
 * `pnpm test` includes a check that lists the ones still present (as a warning).
 */
export const site = {
  /** Product name, used in titles, emails and the app shell. */
  name: "Bidfolio",
  /** One-line value proposition (hero + meta description). */
  tagline: "The bid desk for UK public-sector suppliers",
  description:
    "Bidfolio is a bid desk for UK public-sector suppliers. Replace this description in src/config/site.ts.",
  /** Bare production domain, no protocol. Used in legal pages and e-mail footers. */
  domain: "bidfolio.co.uk",
  supportEmail: "support@bidfolio.co.uk",
  /** Shown as the sender name; the address comes from EMAIL_FROM. */
  emailFromName: "Bidfolio",
  locale: "en",
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
  },
  legal: {
    /** ISO date shown as "Last updated" on every legal page. */
    lastUpdated: "2026-11-13",
    /** Days during which a first payment can be refunded on request. */
    refundWindowDays: 14,
  },
} as const;

export type Site = typeof site;
