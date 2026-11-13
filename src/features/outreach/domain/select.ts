import { OUTREACH_REASON_LABELS, outreachEligibility, type OutreachReason } from "@/features/procurement/domain/outreach";
import type { OutreachSegment } from "./segment";
import type { SuppressionIndex } from "./suppression";

/**
 * From candidate addresses to a list (PURE): who may be written to, who is left out and why.
 *
 * The LEGAL decision is not made here. Every address goes through `outreachEligibility`
 * (src/features/procurement/domain/outreach.ts — P2 §0, §1.3, §8); this module only feeds
 * it what the suppression list knows and then applies the list's own rules: nobody who is
 * already a user, nobody inside the cool-off window, one address per company, one use of
 * an address per list.
 *
 * COUNTING. Every candidate ADDRESS ends in exactly one place: on the list, or under the
 * first rule (in the order of `EXCLUSION_ORDER`) that removed it. So the numbers add up:
 *   addressesConsidered = listed + sum(excluded)
 */

export type CandidateSupplier = {
  id: string;
  name: string;
  slug: string;
  coh: string | null;
  legalForm: string;
  country: string | null;
  removedAt: string | null;
  mergedInto: string | null;
  scale: string | null;
  locality: string | null;
  region: string | null;
};

export type CandidateAward = {
  title: string;
  buyerName: string | null;
  publishedAt: string;
  valueAmount: number | null;
  valueGross: number | null;
  currency: string | null;
  valueShared: boolean;
  isFramework: boolean;
  /** Find a Tender notice id ("103985-2026"). */
  releaseId: string;
  noticeType: string | null;
};

export type CandidateContact = {
  id: string;
  email: string;
  emailHash: string;
  emailDomain: string;
  kind: string;
  namePresent: boolean;
  /** True/false when the notice also gives the company's website; null when it does not. */
  domainMatchesWebsite: boolean | null;
  firstIngestedAt: string;
  lastSeenAt: string;
  /** The stamp on the contact row (a copy of the suppression list; may be missing on a new row). */
  suppressedAt: string | null;
};

/** One supplier with a matching award, and every address published for it (possibly none). */
export type Candidate = { supplier: CandidateSupplier; award: CandidateAward; contacts: CandidateContact[] };

export type SelectionContext = {
  suppression: SuppressionIndex;
  /** Suppliers with a prospect that opted out: the letter promised not to contact the company again. */
  optedOutSupplierIds: ReadonlySet<string>;
  /** Suppliers a workspace has claimed. */
  linkedSupplierIds: ReadonlySet<string>;
  /** Addresses and e-mail domains of registered users. */
  userEmails: ReadonlySet<string>;
  userDomains: ReadonlySet<string>;
  /** Listed or written to inside the cool-off window. */
  coolOff: { emailHashes: ReadonlySet<string>; supplierIds: ReadonlySet<string> };
};

export const EXCLUSION_ORDER = [
  "supplier_removed",
  "suppressed",
  "not_eligible",
  "domain_mismatch",
  "named_not_selected",
  "not_sme",
  "already_user",
  "cool_off",
  "duplicate_address",
  "duplicate_company",
  "over_batch",
] as const;
export type ExclusionKey = (typeof EXCLUSION_ORDER)[number];

export const EXCLUSION_LABELS: Record<ExclusionKey, string> = {
  supplier_removed: "Company removed on request, or its record was merged into another",
  suppressed: "Suppressed: the address, its domain or the company is on the do-not-contact list",
  not_eligible: "Not eligible under the legal gate",
  domain_mismatch: "Address is not on the domain of the company's website",
  named_not_selected: "Named address — this segment takes generic mailboxes only",
  not_sme: "Not marked as a small or medium-sized company in the notice",
  already_user: "Already a user: the company is claimed, or an account exists at this address or domain",
  cool_off: "Already listed or written to inside the cool-off window",
  duplicate_address: "Same address already on this list for another company",
  duplicate_company: "Extra address of a company that is already on this list",
  over_batch: "Eligible, but over the batch size",
};

export type SelectedProspect = {
  supplier: CandidateSupplier;
  award: CandidateAward;
  contact: CandidateContact;
  emailKind: "generic" | "named";
  personalData: boolean;
  /** ISO date; only for addresses that identify a person. */
  contactBy: string | null;
};

export type BuildSummary = {
  companiesMatched: number;
  companiesWithoutAddress: number;
  addressesConsidered: number;
  excluded: Record<ExclusionKey, number>;
  /** `not_eligible` broken down by the first (most fundamental) reason the gate gave. */
  notEligibleByReason: Partial<Record<OutreachReason, number>>;
  /** Companies with a usable address, before the batch size is applied. */
  eligibleCompanies: number;
  listed: number;
  listedGeneric: number;
  listedNamed: number;
};

export type Selection = { prospects: SelectedProspect[]; summary: BuildSummary };

export function reasonLabel(reason: string): string {
  return (OUTREACH_REASON_LABELS as Record<string, string>)[reason] ?? reason;
}

function emptyExclusions(): Record<ExclusionKey, number> {
  return Object.fromEntries(EXCLUSION_ORDER.map((key) => [key, 0])) as Record<ExclusionKey, number>;
}

type Usable = { contact: CandidateContact; personalData: boolean; contactBy: Date | null };

/** Best address first: a role mailbox before a person's, then one on the company's own website domain, then the most recently published. */
function byPreference(a: Usable, b: Usable): number {
  if (a.personalData !== b.personalData) return a.personalData ? 1 : -1;
  const aMatch = a.contact.domainMatchesWebsite === true;
  const bMatch = b.contact.domainMatchesWebsite === true;
  if (aMatch !== bMatch) return aMatch ? -1 : 1;
  if (a.contact.lastSeenAt !== b.contact.lastSeenAt) return a.contact.lastSeenAt > b.contact.lastSeenAt ? -1 : 1;
  return a.contact.email < b.contact.email ? -1 : a.contact.email > b.contact.email ? 1 : 0;
}

export function selectProspects(candidates: readonly Candidate[], segment: OutreachSegment, context: SelectionContext, now: Date = new Date()): Selection {
  const excluded = emptyExclusions();
  const notEligibleByReason: Partial<Record<OutreachReason, number>> = {};
  let companiesWithoutAddress = 0;
  let addressesConsidered = 0;
  const usedEmails = new Set<string>();
  const eligible: SelectedProspect[] = [];

  // Newest award first: those letters are sent first (kit §2), and the batch is cut from this order.
  const ordered = [...candidates].sort((a, b) => (a.award.publishedAt === b.award.publishedAt ? (a.supplier.id < b.supplier.id ? -1 : 1) : a.award.publishedAt > b.award.publishedAt ? -1 : 1));

  for (const candidate of ordered) {
    const { supplier } = candidate;
    if (candidate.contacts.length === 0) {
      companiesWithoutAddress += 1;
      continue;
    }
    const usable: Usable[] = [];
    for (const contact of candidate.contacts) {
      addressesConsidered += 1;
      const listEntry = context.suppression.match(contact.email);
      const suppressedAt = contact.suppressedAt ?? listEntry?.createdAt ?? (context.optedOutSupplierIds.has(supplier.id) ? now : null);
      const gate = outreachEligibility(
        { name: supplier.name, coh: supplier.coh, legalForm: supplier.legalForm, country: supplier.country, removedAt: supplier.removedAt, mergedInto: supplier.mergedInto },
        { email: contact.email, kind: contact.kind, namePresent: contact.namePresent, firstIngestedAt: contact.firstIngestedAt, suppressedAt },
        now,
      );
      if (gate.reasons.includes("supplier_removed") || gate.reasons.includes("supplier_merged")) excluded.supplier_removed += 1;
      else if (gate.reasons.includes("suppressed")) excluded.suppressed += 1;
      else if (!gate.eligible) {
        excluded.not_eligible += 1;
        const reason = gate.reasons[0]!;
        notEligibleByReason[reason] = (notEligibleByReason[reason] ?? 0) + 1;
      } else if (contact.domainMatchesWebsite === false) excluded.domain_mismatch += 1;
      else if (gate.personalData && segment.mailbox === "generic") excluded.named_not_selected += 1;
      else if (segment.smeOnly && supplier.scale !== "sme") excluded.not_sme += 1;
      else if (context.linkedSupplierIds.has(supplier.id) || context.userEmails.has(contact.email) || context.userDomains.has(contact.emailDomain)) excluded.already_user += 1;
      else if (context.coolOff.supplierIds.has(supplier.id) || context.coolOff.emailHashes.has(contact.emailHash)) excluded.cool_off += 1;
      else usable.push({ contact, personalData: gate.personalData, contactBy: gate.contactBy });
    }
    if (usable.length === 0) continue;

    usable.sort(byPreference);
    let chosen: Usable | null = null;
    for (const option of usable) {
      if (chosen) excluded.duplicate_company += 1;
      else if (usedEmails.has(option.contact.email)) excluded.duplicate_address += 1;
      else chosen = option;
    }
    if (!chosen) continue;
    usedEmails.add(chosen.contact.email);
    eligible.push({
      supplier,
      award: candidate.award,
      contact: chosen.contact,
      emailKind: chosen.personalData ? "named" : "generic",
      personalData: chosen.personalData,
      contactBy: chosen.contactBy ? chosen.contactBy.toISOString() : null,
    });
  }

  const prospects = eligible.slice(0, segment.batchSize);
  excluded.over_batch = eligible.length - prospects.length;
  return {
    prospects,
    summary: {
      companiesMatched: candidates.length,
      companiesWithoutAddress,
      addressesConsidered,
      excluded,
      notEligibleByReason,
      eligibleCompanies: eligible.length,
      listed: prospects.length,
      listedGeneric: prospects.filter((prospect) => !prospect.personalData).length,
      listedNamed: prospects.filter((prospect) => prospect.personalData).length,
    },
  };
}
