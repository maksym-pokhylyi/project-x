import { createHash } from "node:crypto";

/**
 * Pure normalisation helpers for organisations named in procurement notices.
 * No I/O, no app imports: used by the mapper, scripts and tests alike.
 */

/** Deterministic id: the same key always yields the same id, on any machine, in any order. */
export function stableId(prefix: string, key: string): string {
  return `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

const LEGAL_WORDS: Array<[RegExp, string]> = [
  [/\bpublic limited company\b/g, "plc"],
  [/\blimited liability partnership\b/g, "llp"],
  [/\blimited partnership\b/g, "lp"],
  [/\bcommunity interest company\b/g, "cic"],
  [/\bcyfyngedig\b/g, "ltd"],
  [/\bcyf\b/g, "ltd"],
  [/\blimited\b/g, "ltd"],
  [/\bltd\b/g, "ltd"],
  [/\bp l c\b/g, "plc"],
  [/\bl l p\b/g, "llp"],
  [/\bc i c\b/g, "cic"],
  [/\bincorporated\b/g, "inc"],
  [/\bcorporation\b/g, "corp"],
  [/\bcompany\b/g, "co"],
];

/**
 * Canonical comparison form of an organisation name: lower case, accents and punctuation
 * removed, "&" spelled out, legal suffixes canonicalised ("Limited" -> "ltd") but KEPT, so
 * "Acme Ltd" and the unincorporated "Acme" never compare equal.
 */
export function normaliseName(name: string | null | undefined): string {
  if (!name) return "";
  let out = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of LEGAL_WORDS) out = out.replace(pattern, replacement);
  out = out.replace(/^the /, "").replace(/\s+/g, " ").trim();
  return out;
}

/** Collapses whitespace and trims; keeps the publisher's own capitalisation. */
export function cleanName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** URL-safe slug: lowercase letters, digits and single dashes. */
export function slugifyName(input: string, maxLength = 60): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "organisation";
}

// ---------------------------------------------------------------------------
// Companies House numbers and legal form
// ---------------------------------------------------------------------------

/**
 * Companies House number in its canonical 8-character form, or null when the published
 * value is not a company number ("TBC", free text, a PPON pasted into the wrong field...).
 * Leading zeros dropped by the publisher are restored ("1243967" -> "01243967").
 */
export function normaliseCompanyNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d{6,8}$/.test(value)) {
    const padded = value.padStart(8, "0");
    return padded === "00000000" ? null : padded;
  }
  // Registered societies: IP12345R, NP…, SP…, RS007648.
  const society = /^(IP|NP|SP|RS)(\d{4,6})(R?)$/.exec(value);
  if (society) return `${society[1]}${society[2]!.padStart(society[3] ? 5 : 6, "0")}${society[3]}`;
  const prefixed = /^([A-Z]{2})(\d{4,6})$/.exec(value);
  if (prefixed && COMPANY_PREFIXES[prefixed[1]!]) return `${prefixed[1]}${prefixed[2]!.padStart(6, "0")}`;
  return null;
}

/**
 * Legal form as far as the notice alone can tell. "company" = a Companies House number
 * of a company type but no recognisable suffix in the published name.
 */
export type LegalForm =
  | "ltd"
  | "plc"
  | "llp"
  | "cic"
  | "company"
  | "lp"
  | "registered_society"
  | "royal_charter"
  | "charitable_incorporated"
  | "overseas"
  | "charity"
  | "public_body"
  | "unknown";

type PrefixKind = "company" | "llp" | "lp" | "scottish_lp" | "registered_society" | "royal_charter" | "charitable_incorporated" | "overseas";

/** Companies House number prefixes (see P2 §1.3). Numbers without a prefix are England & Wales companies. */
const COMPANY_PREFIXES: Record<string, PrefixKind> = {
  SC: "company",
  NI: "company",
  OC: "llp",
  SO: "llp",
  NC: "llp",
  LP: "lp",
  NL: "lp",
  SL: "scottish_lp",
  IP: "registered_society",
  SP: "registered_society",
  NP: "registered_society",
  RS: "registered_society",
  RC: "royal_charter",
  SR: "royal_charter",
  NR: "royal_charter",
  CE: "charitable_incorporated",
  CS: "charitable_incorporated",
  FC: "overseas",
  BR: "overseas",
  SF: "overseas",
  NF: "overseas",
};

/** Suffix found in a (raw) organisation name, if any. */
export function legalSuffix(name: string | null | undefined): "ltd" | "plc" | "llp" | "lp" | "cic" | null {
  const norm = normaliseName(name);
  if (!norm) return null;
  // "X Ltd t a Y", "X Ltd trading as Y": the suffix belongs to the part before the trading name.
  const legalPart = norm.split(/ (?:t a|trading as) /)[0] ?? norm;
  const tokens = legalPart.split(" ");
  // Look at the last three tokens so "Acme Ltd (UK)" or "Acme Ltd 2" still count.
  for (const token of tokens.slice(-3).reverse()) {
    if (token === "ltd" || token === "plc" || token === "llp" || token === "lp" || token === "cic") return token;
  }
  return null;
}

export type LegalFormEvidence = {
  legalForm: LegalForm;
  /** A body with legal personality as far as the notice shows (company number or corporate suffix). */
  isIncorporated: boolean;
  /** What the classification rests on. */
  evidence: "company_number_and_suffix" | "company_number" | "suffix" | "register" | "none";
};

/**
 * Classifies an organisation from what a notice publishes about it: a Companies House
 * number (already normalised), other register identifiers and the name suffix.
 * Deliberately conservative: anything we cannot place is "unknown".
 */
export function classifyLegalForm(input: { coh: string | null; name: string | null | undefined; otherSchemes?: string[] }): LegalFormEvidence {
  const suffix = legalSuffix(input.name);
  if (input.coh) {
    const prefix = /^[A-Z]{2}/.exec(input.coh)?.[0];
    const kind: PrefixKind = prefix ? (COMPANY_PREFIXES[prefix] ?? "company") : "company";
    switch (kind) {
      case "llp":
        return { legalForm: "llp", isIncorporated: true, evidence: suffix === "llp" ? "company_number_and_suffix" : "company_number" };
      case "lp":
      case "scottish_lp":
        // Limited partnerships hold a Companies House number without being a company (P2 §1.3).
        return { legalForm: "lp", isIncorporated: false, evidence: "company_number" };
      case "registered_society":
        return { legalForm: "registered_society", isIncorporated: true, evidence: "company_number" };
      case "royal_charter":
        return { legalForm: "royal_charter", isIncorporated: true, evidence: "company_number" };
      case "charitable_incorporated":
        return { legalForm: "charitable_incorporated", isIncorporated: true, evidence: "company_number" };
      case "overseas":
        return { legalForm: "overseas", isIncorporated: true, evidence: "company_number" };
      default:
        if (suffix === "ltd" || suffix === "plc" || suffix === "cic") {
          return { legalForm: suffix, isIncorporated: true, evidence: "company_number_and_suffix" };
        }
        // A company-type number with an LLP/LP suffix is contradictory: trust neither.
        if (suffix === "llp" || suffix === "lp") return { legalForm: "unknown", isIncorporated: false, evidence: "company_number" };
        return { legalForm: "company", isIncorporated: true, evidence: "company_number" };
    }
  }
  if (suffix === "lp") return { legalForm: "lp", isIncorporated: false, evidence: "suffix" };
  if (suffix) return { legalForm: suffix, isIncorporated: true, evidence: "suffix" };
  const schemes = input.otherSchemes ?? [];
  if (schemes.includes("GB-NHS") || schemes.includes("GB-UKPRN") || schemes.includes("GB-GOR") || schemes.includes("GB-LAE")) {
    return { legalForm: "public_body", isIncorporated: true, evidence: "register" };
  }
  if (schemes.includes("GB-CHC") || schemes.includes("GB-SC") || schemes.includes("GB-NIC")) {
    // A registered charity may be an unincorporated association or trust.
    return { legalForm: "charity", isIncorporated: false, evidence: "register" };
  }
  if (schemes.includes("GB-MPR")) return { legalForm: "registered_society", isIncorporated: true, evidence: "register" };
  return { legalForm: "unknown", isIncorporated: false, evidence: "none" };
}

/** Names published instead of a real supplier ("Withheld Section 94 Supplier", "N/A"...). */
export function isPlaceholderSupplierName(name: string | null | undefined): boolean {
  const norm = normaliseName(name);
  if (!norm || norm.length < 2) return true;
  if (/^withheld\b/.test(norm) || /\bsection ?94\b/.test(norm) || /\bs94\b/.test(norm)) return true;
  return /^(n a|na|none|tbc|tba|unknown|not applicable|various|various suppliers|multiple suppliers|see below|redacted|confidential)$/.test(norm);
}

// ---------------------------------------------------------------------------
// E-mail addresses (internal use only — never rendered on public pages)
// ---------------------------------------------------------------------------

export type EmailKind = "generic" | "named" | "freemail";

/** Consumer webmail and ISP mailboxes: the subscriber is an individual, whatever the business (P2 §8 red lines). */
const FREEMAIL_EXACT = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "icloud.com", "me.com", "mac.com", "msn.com", "aol.com", "aol.co.uk",
  "sky.com", "btinternet.com", "btopenworld.com", "btconnect.com", "talktalk.net", "virginmedia.com", "virgin.net",
  "ntlworld.com", "blueyonder.co.uk", "tiscali.co.uk", "plus.com", "plus.net", "o2.co.uk", "orange.net", "wanadoo.co.uk",
  "lineone.net", "protonmail.com", "proton.me", "pm.me", "mail.com", "email.com", "ymail.com", "rocketmail.com",
  "zoho.com", "hey.com", "tutanota.com", "tuta.io", "mail.ru", "qq.com", "163.com", "126.com", "web.de", "t-online.de",
  "freeserve.co.uk", "fsmail.net", "sbcglobal.net", "comcast.net", "verizon.net", "att.net", "eircom.net",
]);
const FREEMAIL_PATTERNS = [/^hotmail\./, /^live\./, /^yahoo\./, /^outlook\./, /^gmx\./, /^yandex\./, /^fastmail\./, /^windowslive\./];

export function isFreemailDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return FREEMAIL_EXACT.has(d) || FREEMAIL_PATTERNS.some((pattern) => pattern.test(d));
}

/** Words that mark a shared role mailbox. A local part is generic only if EVERY token is one of these. */
const ROLE_WORDS = new Set([
  "info", "information", "sales", "enquiries", "enquiry", "inquiries", "admin", "administration", "office", "tenders", "tender",
  "tendering", "bids", "bid", "bidding", "bidteam", "bidsupport", "bidmanagement", "accounts", "account", "hello", "contact",
  "contactus", "procurement", "contracts", "contract", "finance", "business", "mail", "email", "post", "businessdevelopment",
  "publicsector", "support", "estimating", "estimates", "estimate", "commercial", "marketing", "service", "services", "portals",
  "portal", "opportunities", "submissions", "frameworks", "framework", "orders", "order", "customer", "customers", "customerservice",
  "customerservices", "customercare", "operations", "development", "newbusiness", "general", "bookings", "booking",
  "reception", "help", "helpdesk", "legal", "purchasing", "quotes", "quotations", "projects", "noreply", "donotreply",
  "ukbids", "uktenders", "uksales", "ukinfo", "tendersuk", "salesuk", "headoffice", "works", "training", "recruitment",
  "careers", "billing", "invoices", "press", "media", "partnerships", "compliance", "quality", "solutions", "proposals",
  "proposal", "pqq", "itt", "rfp", "rfq", "enquire", "hr",
  // qualifiers that may accompany a role word: sales.uk@, tenders-north@, info.team@
  "uk", "gb", "team", "desk", "dept", "department", "group", "central", "main", "north", "south", "east", "west", "london",
  "scotland", "wales", "ireland", "england", "national", "public", "sector", "new", "and",
]);
/** Qualifiers alone ("uk@", "team@", "london@") do not make a mailbox generic. */
const QUALIFIER_ONLY = new Set([
  "uk", "gb", "team", "desk", "dept", "department", "group", "central", "main", "north", "south", "east", "west", "london",
  "scotland", "wales", "ireland", "england", "national", "public", "sector", "new", "and",
]);

/**
 * Classifies a published contact address:
 *  - "freemail": consumer/ISP domain — the subscriber is an individual;
 *  - "generic":  a role mailbox on the organisation's own domain (info@, tenders@…);
 *  - "named":    everything else. When in doubt it is "named" (treated as personal data).
 * Returns null for strings that are not usable addresses.
 */
export function classifyEmail(raw: string | null | undefined): { email: string; domain: string; kind: EmailKind } | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || /\s/.test(email)) return null;
  const match = /^([a-z0-9._%+'-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/.exec(email);
  if (!match) return null;
  const local = match[1]!;
  const domain = match[2]!;
  if (isFreemailDomain(domain)) return { email, domain, kind: "freemail" };
  const tokens = local.split(/[._+\-\d']+/).filter(Boolean);
  const joined = tokens.join("");
  const everyTokenIsRole = tokens.length > 0 && tokens.every((token) => ROLE_WORDS.has(token)) && tokens.some((token) => !QUALIFIER_ONLY.has(token));
  const generic =
    everyTokenIsRole ||
    (ROLE_WORDS.has(joined) && !QUALIFIER_ONLY.has(joined)) ||
    // compounds such as "salesteam", "tendersdesk", "infouk", "ukbids"
    /^(uk)?(info|sales|tenders?|bids?|enquir(y|ies)|admin|accounts|office|contracts|procurement|estimating|commercial|support)(team|desk|uk|dept|department|office|group|mailbox|inbox|box)?$/.test(joined);
  return { email, domain, kind: generic ? "generic" : "named" };
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** "PO30 5XJ" -> "PO"; null for non-UK or malformed postcodes. */
export function postcodeArea(postcode: string | null | undefined): string | null {
  const match = /^\s*([A-Za-z]{1,2})\d/.exec(postcode ?? "");
  return match ? match[1]!.toUpperCase() : null;
}

/** Website host without protocol or "www.", for domain checks; null when unusable. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}
