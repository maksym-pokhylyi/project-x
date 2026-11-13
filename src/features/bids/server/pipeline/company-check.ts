import {
  TURNOVER_BAND_LABELS,
  TURNOVER_BAND_RANGES,

  type Citation,
  type CompanyFacts,
  type CompanyStatus,
  type InsuranceCover,
  type RequirementCategory,
  type RequirementKind,
} from "@/features/bids/types";
import { thresholdMagnitudes, tightText } from "./quote-verify";

/**
 * Company check: requirement vs company facts -> met | gap | unknown | verify, and a
 * cautious verdict. Pure functions.
 *
 * The model proposes a status per requirement; these rules have the last word:
 *  - nothing is asserted from facts a person has not confirmed;
 *  - a requirement whose own citation is unverified is "verify", whatever the facts say;
 *  - insurance levels and turnover tests are decided by arithmetic, not by the model;
 *  - "met" for an accreditation needs the accreditation's name to be visibly in the
 *    requirement and a certificate that is not expired.
 */

export type CheckRequirement = {
  id: string;
  category: RequirementCategory;
  text: string;
  threshold: string | null;
  kind: RequirementKind;
  isPassFail: boolean;
  evidenceToProvide: string | null;
  citation: Citation | null;
  /** Rows whose status a person set by hand are left alone. */
  statusSetByUser?: boolean;
  currentStatus?: CompanyStatus;
  currentNote?: string | null;
};

export type ModelProposal = { status: "met" | "gap" | "unknown"; reason: string };

export type CheckResult = { id: string; status: CompanyStatus; note: string | null };

const gbp = (amount: number): string => {
  if (amount >= 1_000_000) return `£${Math.round((amount / 1_000_000) * 100) / 100}m`;
  if (amount >= 1_000) return `£${Math.round(amount / 1_000)}k`;
  return `£${amount}`;
};

type InsuranceType = "publicLiability" | "employersLiability" | "professionalIndemnity";

const INSURANCE_PATTERNS: Array<{ type: InsuranceType; label: string; pattern: RegExp }> = [
  { type: "publicLiability", label: "public liability", pattern: /public\s+(and\s+products?\s+)?liability|third[-\s]party liability/i },
  { type: "employersLiability", label: "employers' liability", pattern: /employer'?s?'?\s+liability/i },
  { type: "professionalIndemnity", label: "professional indemnity", pattern: /professional\s+indemnity/i },
];

/** Money amounts a requirement asks for (£10k or more), largest reading of each figure. */
export function requiredAmounts(threshold: string | null, text: string): number[] {
  const fromThreshold = thresholdMagnitudes(threshold ?? "")
    .map(Number)
    .filter((value) => value >= 10_000);
  if (fromThreshold.length > 0) return [...new Set(fromThreshold)];
  const amounts: number[] = [];
  const pattern = /£\s?(\d[\d,]*(?:\.\d+)?)\s*(million|m|k|thousand|bn|billion)?(?![a-z])/gi;
  for (const match of text.matchAll(pattern)) {
    const base = Number(match[1]!.replace(/,/g, ""));
    const unit = match[2]?.toLowerCase();
    const multiplier = unit === "million" || unit === "m" ? 1e6 : unit === "k" || unit === "thousand" ? 1e3 : unit === "bn" || unit === "billion" ? 1e9 : 1;
    const value = base * multiplier;
    if (Number.isFinite(value) && value >= 10_000) amounts.push(value);
  }
  return [...new Set(amounts)];
}

function acceptsCommitment(requirement: CheckRequirement): boolean {
  return /commit(ment)? to obtain|prior to (contract )?(award|commencement)|before (contract )?(award|commencement|the contract starts)|if (successful|awarded)|will obtain|upon award/i.test(
    `${requirement.text} ${requirement.evidenceToProvide ?? ""} ${requirement.citation?.quote ?? ""}`,
  );
}

function isExpired(date: string | null | undefined, on: Date): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return false;
  return new Date(`${date.slice(0, 10)}T23:59:59Z`).getTime() < on.getTime();
}

function checkInsurance(requirement: CheckRequirement, facts: CompanyFacts, today: Date): CheckResult | null {
  const haystack = `${requirement.text} ${requirement.threshold ?? ""}`;
  const types = INSURANCE_PATTERNS.filter((entry) => entry.pattern.test(haystack));
  const amounts = requiredAmounts(requirement.threshold, requirement.text);
  if (types.length >= 1 && amounts.length === 0) {
    // "Provide details and certificates of your … insurance": no level is asked for, so
    // holding current cover of each named type is what can be checked.
    const covers = types.map((entry) => ({ ...entry, cover: facts.insurance?.[entry.type] }));
    const missing = covers.filter((entry) => !entry.cover || entry.cover.amountGbp === null || entry.cover.amountGbp === undefined);
    if (missing.length > 0) return { id: requirement.id, status: "unknown", note: `Your company facts do not give your ${missing.map((entry) => entry.label).join(" or ")} cover.` };
    const expired = covers.filter((entry) => isExpired(entry.cover!.expiresAt, today));
    if (expired.length > 0) {
      return { id: requirement.id, status: "verify", note: `The renewal date on file for your ${expired.map((entry) => entry.label).join(" and ")} cover has passed. Check it has been renewed.` };
    }
    return {
      id: requirement.id,
      status: "met",
      note: `You hold ${covers.map((entry) => `${gbp(entry.cover!.amountGbp!)} ${entry.label}`).join(" and ")} cover. The tender asks for details, not a set level — have the certificate${covers.length === 1 ? "" : "s"} ready.`,
    };
  }
  if (types.length !== 1) return null; // several covers with levels in one requirement: leave it to a person
  if (amounts.length !== 1) return null;
  const required = amounts[0]!;
  const { type, label } = types[0]!;
  const cover: InsuranceCover | null | undefined = facts.insurance?.[type];
  if (!cover || cover.amountGbp === null || cover.amountGbp === undefined) {
    return { id: requirement.id, status: "unknown", note: `Your company facts do not give your ${label} cover. The tender asks for ${gbp(required)}.` };
  }
  if (cover.amountGbp >= required) {
    if (isExpired(cover.expiresAt, today)) {
      return { id: requirement.id, status: "verify", note: `You hold ${gbp(cover.amountGbp)} ${label} cover, but the renewal date on file (${cover.expiresAt}) has passed. Check it has been renewed.` };
    }
    return { id: requirement.id, status: "met", note: `You hold ${gbp(cover.amountGbp)} ${label} cover; the tender asks for ${gbp(required)}.` };
  }
  const commitment = acceptsCommitment(requirement) ? " The pack appears to accept a commitment to obtain the cover before award — check the wording." : "";
  return { id: requirement.id, status: "gap", note: `You hold ${gbp(cover.amountGbp)} ${label} cover; the tender asks for ${gbp(required)}.${commitment}` };
}

function checkTurnover(requirement: CheckRequirement, facts: CompanyFacts): CheckResult | null {
  const text = `${requirement.text} ${requirement.threshold ?? ""}`;
  if (!/turnover/i.test(text)) return null;
  // Relative tests ("twice the contract value") cannot be decided from a band.
  if (/\b(times|x|twice|double|multiple|ratio|%|percent)\b/i.test(text) && !/£/.test(requirement.threshold ?? "")) return null;
  const amounts = requiredAmounts(requirement.threshold, requirement.text);
  if (amounts.length !== 1) return null;
  const required = amounts[0]!;
  // Exact figures from the accounts decide it outright; the band is the fallback.
  const latest = facts.turnover?.latestGbp ?? null;
  if (latest !== null) {
    const previous = facts.turnover?.previousGbp ?? null;
    const bothYears = /\b(each|both|every)\b[^.]{0,40}\b(two|2|three|3)\b[^.]{0,20}\byears?\b|\blast (two|2) (financial )?years\b/i.test(text);
    const year = facts.turnover?.yearEnd ? ` in the year to ${facts.turnover.yearEnd}` : " in your latest year";
    if (latest < required) return { id: requirement.id, status: "gap", note: `Your turnover was ${gbp(latest)}${year}; the tender asks for ${gbp(required)}.` };
    if (bothYears && previous === null) return { id: requirement.id, status: "unknown", note: `Your turnover was ${gbp(latest)}${year}, above the ${gbp(required)} asked for — but the tender asks about more than one year and your facts give only the latest.` };
    if (bothYears && previous !== null && previous < required) return { id: requirement.id, status: "gap", note: `Your turnover was ${gbp(latest)}${year} but ${gbp(previous)} the year before; the tender asks for ${gbp(required)} in each year.` };
    return { id: requirement.id, status: "met", note: `Your turnover was ${gbp(latest)}${year}${bothYears && previous !== null ? ` and ${gbp(previous)} the year before` : ""}; the tender asks for ${gbp(required)}.` };
  }
  if (!facts.turnoverBand) return { id: requirement.id, status: "unknown", note: `Your company facts do not give your turnover. The tender asks for ${gbp(required)}.` };
  const [min, max] = TURNOVER_BAND_RANGES[facts.turnoverBand];
  const band = TURNOVER_BAND_LABELS[facts.turnoverBand];
  if (min >= required) return { id: requirement.id, status: "met", note: `Your turnover band (${band}) is above the ${gbp(required)} the tender asks for.` };
  if (max !== null && max <= required) return { id: requirement.id, status: "gap", note: `Your turnover band (${band}) is below the ${gbp(required)} the tender asks for.` };
  return { id: requirement.id, status: "unknown", note: `Your turnover band (${band}) includes the ${gbp(required)} threshold — check your latest accounts.` };
}

/** Name of an accreditation reduced to what must appear in a requirement ("ISO 9001:2015" -> "iso9001"). */
export function accreditationKey(name: string): string {
  return tightText(name.split(/[:(]/)[0] ?? name);
}

function guardAccreditation(requirement: CheckRequirement, facts: CompanyFacts, proposal: ModelProposal, today: Date, deadline: Date | null): CheckResult {
  const requirementTight = tightText(`${requirement.text} ${requirement.threshold ?? ""} ${requirement.citation?.quote ?? ""}`);
  const named = (facts.accreditations ?? []).filter((accreditation) => {
    const key = accreditationKey(accreditation.name);
    if (key.length < 3 || !requirementTight.includes(key)) return false;
    // "Cyber Essentials" on file does not satisfy "Cyber Essentials Plus".
    if (requirementTight.includes(`${key}plus`) && !tightText(accreditation.name).includes("plus")) return false;
    return true;
  });
  if (named.length === 0) {
    return { id: requirement.id, status: "verify", note: `${proposal.reason} We could not match this to a named accreditation in your company facts — check it.`.trim() };
  }
  const valid = named.filter((accreditation) => !isExpired(accreditation.expiresAt, today));
  if (valid.length === 0) {
    const expired = named[0]!;
    return { id: requirement.id, status: "gap", note: `${expired.name} on your company facts expired on ${expired.expiresAt}.` };
  }
  const lasting = valid.filter((accreditation) => !deadline || !isExpired(accreditation.expiresAt, deadline));
  if (lasting.length === 0) {
    const expiring = valid[0]!;
    return { id: requirement.id, status: "verify", note: `${expiring.name} expires on ${expiring.expiresAt}, before the submission deadline. Renew it or check the buyer accepts it.` };
  }
  return { id: requirement.id, status: "met", note: `You hold ${lasting[0]!.name}${lasting[0]!.expiresAt ? ` (valid to ${lasting[0]!.expiresAt})` : ""}.` };
}

export type ResolveOptions = {
  requirements: CheckRequirement[];
  facts: CompanyFacts;
  /** True only when a person has confirmed the company facts. */
  factsConfirmed: boolean;
  /** Model proposals by requirement id (may be missing for some). */
  proposals: Map<string, ModelProposal>;
  submissionDeadline: Date | null;
  today?: Date;
};

export function resolveCompanyStatuses(options: ResolveOptions): CheckResult[] {
  const today = options.today ?? new Date();
  return options.requirements.map((requirement): CheckResult => {
    if (requirement.statusSetByUser) {
      return { id: requirement.id, status: requirement.currentStatus ?? "unknown", note: requirement.currentNote ?? null };
    }
    if (!requirement.citation || !requirement.citation.verified) {
      const why =
        requirement.citation?.issue === "figure_not_in_source"
          ? "The figure in this requirement was not found in the cited text."
          : "We could not find this requirement's quote in the tender documents.";
      return { id: requirement.id, status: "verify", note: `${why} Check the documents before relying on it.` };
    }
    if (!options.factsConfirmed) {
      return { id: requirement.id, status: "unknown", note: "Confirm your company facts in Documents to check this requirement." };
    }
    if (requirement.category === "insurance") {
      const decided = checkInsurance(requirement, options.facts, today);
      if (decided) return decided;
    }
    if (requirement.category === "financial") {
      const decided = checkTurnover(requirement, options.facts);
      if (decided) return decided;
    }
    const proposal = options.proposals.get(requirement.id);
    if (!proposal || proposal.status === "unknown") {
      return { id: requirement.id, status: "unknown", note: proposal?.reason?.trim() || "Your company facts do not cover this." };
    }
    if (proposal.status === "gap") return { id: requirement.id, status: "gap", note: proposal.reason.trim() || null };
    // "met" proposals: insurance and money tests must have been settled by arithmetic above.
    if (requirement.category === "insurance" || (requirement.category === "financial" && requiredAmounts(requirement.threshold, requirement.text).length > 0)) {
      return { id: requirement.id, status: "verify", note: `${proposal.reason.trim()} We could not confirm the figures automatically — check them.`.trim() };
    }
    if (requirement.category === "accreditation") {
      return guardAccreditation(requirement, options.facts, proposal, today, options.submissionDeadline);
    }
    return { id: requirement.id, status: "met", note: proposal.reason.trim() || null };
  });
}
