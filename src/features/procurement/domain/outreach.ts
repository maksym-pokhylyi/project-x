import { isFreemailDomain, legalSuffix, normaliseCompanyNumber, type EmailKind, type LegalForm } from "./normalize";

/**
 * Outreach gate (PURE). Decides whether a supplier's published contact address may be used
 * for a first B2B e-mail. It encodes the conservative reading in
 * docs/research/round2/P2-outreach-legal-deliverability.md §0, §1.3 and §8:
 *
 *  - only bodies we can show to be corporate subscribers: a Companies House number of a
 *    company or LLP type AND a matching Ltd / PLC / LLP suffix in the published name;
 *  - limited partnerships, sole traders, ordinary partnerships, charities without a company
 *    number and anything we cannot place are NOT eligible ("if unsure, treat as individual");
 *  - consumer webmail / ISP addresses are never eligible, whatever the business;
 *  - an address that identifies a person may only be contacted within one month of the day
 *    we first stored it (UK GDPR Art. 14);
 *  - suppressed addresses and removed suppliers are never eligible.
 *
 * This is the notice-level gate only. The sending tool must still check the live Companies
 * House register and its own suppression list before every send.
 */

/** Legal forms that pass. CIC and registered societies are corporate bodies too (P2 §0) but are left out until the lead decides. */
export const OUTREACH_ELIGIBLE_LEGAL_FORMS: readonly LegalForm[] = ["ltd", "plc", "llp"];

/** Days a named-person address may be held before the first contact. */
export const NAMED_ADDRESS_CONTACT_WINDOW_DAYS = 30;

export type OutreachReason =
  | "no_company_number"
  | "invalid_company_number"
  | "limited_partnership"
  | "legal_form_not_allowed"
  | "legal_form_unknown"
  | "name_suffix_missing"
  | "non_uk_supplier"
  | "supplier_removed"
  | "supplier_merged"
  | "invalid_email"
  | "freemail_domain"
  | "named_address_past_one_month"
  | "suppressed";

export type OutreachSupplier = {
  name: string;
  /** Companies House number as stored (canonical form). */
  coh: string | null;
  legalForm: LegalForm | string;
  /** ISO country of the published address; null when unknown. */
  country?: string | null;
  removedAt?: Date | string | null;
  mergedInto?: string | null;
};

export type OutreachContact = {
  email: string;
  kind: EmailKind | string;
  /** A personal name was published next to the address. */
  namePresent: boolean;
  /** When we first stored the address. */
  firstIngestedAt: Date | string;
  suppressedAt?: Date | string | null;
};

export type OutreachEligibility = {
  eligible: boolean;
  /** Every failed rule, most fundamental first. Empty when eligible. */
  reasons: OutreachReason[];
  /** The address identifies a person: UK GDPR duties apply even when eligible. */
  personalData: boolean;
  /** For named addresses: last day a first contact is allowed. */
  contactBy: Date | null;
};

const DAY_MS = 86_400_000;

export function outreachEligibility(supplier: OutreachSupplier, contact: OutreachContact, now: Date = new Date()): OutreachEligibility {
  const reasons: OutreachReason[] = [];

  // --- entity evidence ---------------------------------------------------------------------
  if (supplier.removedAt) reasons.push("supplier_removed");
  if (supplier.mergedInto) reasons.push("supplier_merged");
  if (!supplier.coh) {
    reasons.push("no_company_number");
  } else if (normaliseCompanyNumber(supplier.coh) !== supplier.coh) {
    reasons.push("invalid_company_number");
  }
  const form = supplier.legalForm;
  if (form === "lp") {
    reasons.push("limited_partnership");
  } else if (form === "unknown" || form === "company") {
    // "company": a company-type number but no Ltd/PLC suffix in the name — cannot be cross-checked from the notice.
    reasons.push(form === "company" ? "name_suffix_missing" : "legal_form_unknown");
  } else if (!(OUTREACH_ELIGIBLE_LEGAL_FORMS as readonly string[]).includes(form)) {
    reasons.push("legal_form_not_allowed");
  } else {
    const suffix = legalSuffix(supplier.name);
    if (suffix !== form) reasons.push("name_suffix_missing");
  }
  if (supplier.country && supplier.country.toUpperCase() !== "GB") reasons.push("non_uk_supplier");

  // --- address -----------------------------------------------------------------------------
  const email = contact.email.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  const domain = at > 0 ? email.slice(at + 1) : "";
  const validEmail = /^[^@\s]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email);
  if (!validEmail) reasons.push("invalid_email");
  if (contact.kind === "freemail" || (validEmail && isFreemailDomain(domain))) reasons.push("freemail_domain");
  if (contact.suppressedAt) reasons.push("suppressed");

  // Anything that is not clearly a role mailbox is treated as a person's address.
  const personalData = contact.kind !== "generic" || contact.namePresent;
  let contactBy: Date | null = null;
  if (personalData) {
    const first = new Date(contact.firstIngestedAt);
    if (Number.isNaN(first.getTime())) {
      reasons.push("named_address_past_one_month");
    } else {
      contactBy = new Date(first.getTime() + NAMED_ADDRESS_CONTACT_WINDOW_DAYS * DAY_MS);
      if (now.getTime() > contactBy.getTime()) reasons.push("named_address_past_one_month");
    }
  }

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)], personalData, contactBy };
}

export const OUTREACH_REASON_LABELS: Record<OutreachReason, string> = {
  no_company_number: "No Companies House number in the notice",
  invalid_company_number: "Company number is not in a valid format",
  limited_partnership: "Limited partnership (not a separate legal person)",
  legal_form_not_allowed: "Legal form is not on the allow-list",
  legal_form_unknown: "Legal form cannot be established from the notice",
  name_suffix_missing: "Published name has no matching Ltd / PLC / LLP suffix",
  non_uk_supplier: "Supplier address is outside the UK",
  supplier_removed: "Supplier asked to be removed",
  supplier_merged: "Record merged into another supplier",
  invalid_email: "Address is not a valid email address",
  freemail_domain: "Consumer webmail or ISP address",
  named_address_past_one_month: "Named address held for more than one month without contact",
  suppressed: "Address is suppressed",
};
