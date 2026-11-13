/**
 * The suppression list as data (PURE): what may be put on it, and whether an address is
 * covered by it. Suppression is by ADDRESS (or by domain), never by contact row.
 */
export const SUPPRESSION_REASONS = ["optout", "bounce", "complaint", "manual", "data_request"] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  optout: "Opted out",
  bounce: "Bounced",
  complaint: "Complaint",
  manual: "Added by hand",
  data_request: "Data request",
};

export type SuppressionTarget = { kind: "email"; value: string; domain: string } | { kind: "domain"; value: string };

const EMAIL = /^[a-z0-9._%+'-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;
const DOMAIN = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
/** Suffixes that are not anybody's domain: suppressing one would silently empty every list. */
const PUBLIC_SUFFIXES = new Set(["co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "com.au", "co.nz", "co.za", "com.cn", "co.in", "co.jp"]);

/** A lower-cased e-mail address, or null. */
export function normaliseEmail(input: string | null | undefined): { email: string; domain: string } | null {
  const email = (input ?? "").trim().toLowerCase();
  if (email.length > 254) return null;
  const match = EMAIL.exec(email);
  return match ? { email, domain: match[1]! } : null;
}

/**
 * What the founder typed into "add to suppressions": an address, or a domain written as
 * "example.co.uk", "@example.co.uk", "*.example.co.uk" or a web address.
 */
export function normaliseTarget(input: string | null | undefined): SuppressionTarget | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("@") && !raw.startsWith("@")) {
    const email = normaliseEmail(raw);
    return email ? { kind: "email", value: email.email, domain: email.domain } : null;
  }
  const domain = raw
    .replace(/^@/, "")
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^\*\./, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
  if (!DOMAIN.test(domain) || PUBLIC_SUFFIXES.has(domain)) return null;
  return { kind: "domain", value: domain };
}

/** The domain itself and every parent that could be on the list: "mail.acme.co.uk" -> itself, "acme.co.uk", "co.uk". */
export function domainAndParents(domain: string): string[] {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  const out: string[] = [];
  for (let index = 0; index < labels.length - 1; index += 1) out.push(labels.slice(index).join("."));
  return out;
}

export type SuppressionEntry = { email: string | null; domain: string | null; reason: string; createdAt: Date | string };
export type SuppressionMatch = { via: "email" | "domain"; reason: string; createdAt: Date };

export type SuppressionIndex = {
  size: number;
  /** The entry that covers this address — its own, or one for its domain or a parent domain. */
  match: (email: string) => SuppressionMatch | null;
};

export function buildSuppressionIndex(entries: readonly SuppressionEntry[]): SuppressionIndex {
  const emails = new Map<string, SuppressionMatch>();
  const domains = new Map<string, SuppressionMatch>();
  for (const entry of entries) {
    const createdAt = new Date(entry.createdAt);
    if (entry.email) emails.set(entry.email.toLowerCase(), { via: "email", reason: entry.reason, createdAt });
    else if (entry.domain) domains.set(entry.domain.toLowerCase(), { via: "domain", reason: entry.reason, createdAt });
  }
  return {
    size: emails.size + domains.size,
    match(email: string) {
      const address = email.trim().toLowerCase();
      const direct = emails.get(address);
      if (direct) return direct;
      const at = address.lastIndexOf("@");
      if (at < 0) return null;
      for (const domain of domainAndParents(address.slice(at + 1))) {
        const found = domains.get(domain);
        if (found) return found;
      }
      return null;
    },
  };
}

const EMAIL_IN_TEXT = /[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;

/**
 * Every distinct address in a pasted bounce list or an uploaded CSV, whatever its layout —
 * one per line, a column among others, "Name <address>" or a bounce message.
 */
export function extractEmails(text: string, limit = 5000): { emails: string[]; truncated: boolean } {
  const found = new Set<string>();
  let truncated = false;
  for (const match of text.matchAll(EMAIL_IN_TEXT)) {
    const email = normaliseEmail(match[0].replace(/^['.]+|['.]+$/g, ""));
    if (!email) continue;
    if (found.size >= limit) {
      truncated = true;
      break;
    }
    found.add(email.email);
  }
  return { emails: [...found], truncated };
}
