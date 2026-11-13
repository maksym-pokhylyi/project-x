import type { BidVerdict, CompanyStatus, RequirementCategory, RequirementKind } from "@/features/bids/types";

/**
 * The verdict shown on the brief. Pure function.
 *
 * Deliberately cautious: it never says a bid will win, it says "Looks biddable" only when
 * every gating requirement is positively met, and it always lists what it cannot assess
 * (the spike's bid/no-bid test missed a conflict of interest that needed connecting a CV
 * line to a partner named in the tender).
 */

export type VerdictRequirement = { text: string; isPassFail: boolean; kind: RequirementKind; category: RequirementCategory; status: CompanyStatus };

/** Standing list of what a document check cannot tell a bidder. */
export const NOT_ASSESSED = [
  "Conflicts of interest and connected persons",
  "Whether you have the capacity to deliver alongside your current work",
  "Price competitiveness and whether the budget is workable for you",
  "What your referees will say",
  "Declarations that need legal judgement (exclusion grounds, convictions, tax)",
  "Anything in documents that were not uploaded (portal messages, later clarifications)",
] as const;

const OBJECTIVE_CATEGORIES: RequirementCategory[] = ["insurance", "financial", "accreditation"];

/**
 * A requirement that can stop a bid on its own: explicitly pass/fail, a minimum score, or a
 * mandatory insurance level, financial test or accreditation (buyers treat those as
 * conditions of participation whether or not the pack says "pass/fail").
 */
export function isGating(item: Pick<VerdictRequirement, "isPassFail" | "kind" | "category">): boolean {
  return item.isPassFail || item.kind === "minimum_score" || (item.kind === "mandatory" && OBJECTIVE_CATEGORIES.includes(item.category));
}

const short = (text: string, max = 110): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function computeVerdict(requirements: VerdictRequirement[], factsConfirmed: boolean, now: Date = new Date()): BidVerdict {
  const gates = requirements.filter(isGating);
  const counts = {
    requirements: requirements.length,
    passFail: requirements.filter((item) => item.isPassFail).length,
    gating: gates.length,
    met: requirements.filter((item) => item.status === "met").length,
    gap: requirements.filter((item) => item.status === "gap").length,
    unknown: requirements.filter((item) => item.status === "unknown").length,
    verify: requirements.filter((item) => item.status === "verify").length,
  };
  const base = { counts, factsConfirmed, generatedAt: now.toISOString(), notAssessed: [...NOT_ASSESSED] };

  if (requirements.length === 0) {
    return { ...base, verdict: "not_enough_information", reasons: ["No requirements were found in the pack. Check the documents or add requirements by hand."] };
  }
  if (!factsConfirmed) {
    return {
      ...base,
      verdict: "not_enough_information",
      reasons: [
        "Your company facts have not been confirmed, so requirements could not be checked against them.",
        `${plural(gates.length, "pass/fail or mandatory eligibility requirement")} found — review each one below.`,
      ],
    };
  }

  const gateGaps = gates.filter((item) => item.status === "gap");
  if (gateGaps.length > 0) {
    return {
      ...base,
      verdict: "likely_not_eligible",
      reasons: [
        ...gateGaps.slice(0, 5).map((item) => `${item.isPassFail ? "Pass/fail gap" : "Eligibility gap"}: ${short(item.text)}`),
        ...(gateGaps.length > 5 ? [`…and ${gateGaps.length - 5} more.`] : []),
        "Check each gap against the documents: some can be closed before the deadline, or before award where the pack allows it.",
      ],
    };
  }

  const undecided = gates.filter((item) => item.status === "unknown" || item.status === "verify");
  const otherGaps = requirements.filter((item) => item.status === "gap");
  if (gates.length > 0 && undecided.length * 2 > gates.length) {
    return {
      ...base,
      verdict: "not_enough_information",
      reasons: [
        `${undecided.length} of ${plural(gates.length, "pass/fail or mandatory eligibility requirement")} could not be checked against your company facts.`,
        ...undecided.slice(0, 4).map((item) => `To check: ${short(item.text)}`),
      ],
    };
  }
  if (otherGaps.length > 0 || undecided.length > 0) {
    return {
      ...base,
      verdict: "biddable_with_gaps",
      reasons: [
        ...otherGaps.slice(0, 4).map((item) => `Gap: ${short(item.text)}`),
        ...undecided.slice(0, 4).map((item) => `To check: ${short(item.text)}`),
        ...(gates.length > 0 ? [`${gates.length - undecided.length} of ${plural(gates.length, "pass/fail or mandatory eligibility requirement")} look met.`] : []),
      ],
    };
  }
  if (gates.length === 0 && counts.met === 0) {
    return {
      ...base,
      verdict: "not_enough_information",
      reasons: ["No pass/fail or mandatory eligibility requirements were found, and none of the others could be checked against your company facts."],
    };
  }
  const stillOpen = counts.unknown + counts.verify;
  return {
    ...base,
    verdict: "looks_biddable",
    reasons: [
      gates.length > 0 ? `All ${plural(gates.length, "pass/fail or mandatory eligibility requirement")} look met against your confirmed company facts.` : "No gating requirements were found, and no gaps against your confirmed company facts.",
      ...(stillOpen > 0 ? [`${plural(stillOpen, "other requirement")} still to check by hand.`] : []),
      "This is a check of stated requirements only — it says nothing about your chances of winning.",
    ],
  };
}
