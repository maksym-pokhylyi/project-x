/**
 * Notice classification.
 *
 * `tag` alone cannot identify a notice (UK5, UK6, UK7, UK14 and UK15 all carry
 * ["award","contract"]). The reliable signal is the `noticeType` of the document whose id
 * equals the release id; legacy notices (pre-Procurement Act) have none and fall back to
 * their tags.
 */
export type NoticeStage = "planning" | "tender" | "award" | "contract" | "market";
export type Regime = "PA23" | "legacy";

export type NoticeTypeInfo = {
  /** Name used on Find a Tender. */
  officialName: string;
  stage: NoticeStage;
  /** Whether award entries in this notice are contract wins (false for dynamic-market membership lists). */
  awardsAreWins: boolean;
};

export const NOTICE_TYPES: Record<string, NoticeTypeInfo> = {
  UK1: { officialName: "Pipeline notice", stage: "planning", awardsAreWins: false },
  UK2: { officialName: "Preliminary market engagement notice", stage: "planning", awardsAreWins: false },
  UK3: { officialName: "Planned procurement notice", stage: "planning", awardsAreWins: false },
  UK4: { officialName: "Tender notice", stage: "tender", awardsAreWins: false },
  UK5: { officialName: "Transparency notice", stage: "award", awardsAreWins: true },
  UK6: { officialName: "Contract award notice", stage: "award", awardsAreWins: true },
  UK7: { officialName: "Contract details notice", stage: "award", awardsAreWins: true },
  UK9: { officialName: "Contract performance notice", stage: "contract", awardsAreWins: false },
  UK10: { officialName: "Contract change notice", stage: "contract", awardsAreWins: false },
  UK11: { officialName: "Contract termination notice", stage: "contract", awardsAreWins: false },
  UK12: { officialName: "Procurement termination notice", stage: "tender", awardsAreWins: false },
  UK13: { officialName: "Dynamic market intention notice", stage: "market", awardsAreWins: false },
  UK14: { officialName: "Dynamic market establishment notice", stage: "market", awardsAreWins: false },
  UK15: { officialName: "Dynamic market modification notice", stage: "market", awardsAreWins: false },
  UK16: { officialName: "Dynamic market cessation notice", stage: "market", awardsAreWins: false },
  UK17: { officialName: "Payments compliance notice", stage: "contract", awardsAreWins: false },
};

/** Stage of a legacy notice from its tags. */
export function legacyStage(tags: string[]): NoticeStage {
  const has = (prefix: string) => tags.some((tag) => tag === prefix || tag === `${prefix}Update`);
  if (has("award") || has("contract")) return "award";
  if (tags.includes("tenderCancellation")) return "tender";
  if (has("tender")) return "tender";
  if (has("planning")) return "planning";
  if (tags.some((tag) => tag === "implementation" || tag === "contractAmendment" || tag === "contractTermination")) return "contract";
  return "tender";
}

/** How a contract was (or will be) competed, reduced to what matters to a small supplier. */
export type Competition = "open" | "limited" | "direct" | "framework" | "unknown";

/**
 * Maps `procurementMethodDetails` (the UK label, the field to trust) with
 * `procurementMethod` as fallback.
 *  open      — advertised to everyone (open procedure, competitive flexible, below-threshold open competition)
 *  limited   — invited suppliers only (restricted, negotiated with a call, below-threshold limited competition)
 *  direct    — no competition (direct award, below-threshold without competition, award without prior publication)
 *  framework — call-off under a framework or dynamic market
 */
export function competitionOf(details: string | null | undefined, method: string | null | undefined): Competition {
  const label = (details ?? "").toLowerCase();
  if (label) {
    if (label.includes("framework") || label.includes("dynamic market") || label.includes("commercial tool")) return "framework";
    if (label.includes("without competition") || label.includes("direct award") || label.includes("without prior publication") || label.includes("without publication")) return "direct";
    if (label.includes("limited competition")) return "limited";
    if (label.includes("open") || label.includes("competitive flexible")) return "open";
    if (label.includes("restricted") || label.includes("negotiat") || label.includes("competitive dialogue") || label.includes("competitive procedure")) return "limited";
    if (label.includes("unknown")) return "unknown";
  }
  switch ((method ?? "").toLowerCase()) {
    case "open":
      return "open";
    case "selective":
    case "limited":
      return "limited";
    case "direct":
      return "direct";
    default:
      return "unknown";
  }
}

/** Badge shown to users, in the buyer's language (DESIGN.md §5 NoticeBadge). */
export type NoticeBadgeKind = "tender" | "below_threshold" | "framework" | "early" | "award" | "contract" | "market" | "closed";

export function noticeBadgeKind(notice: {
  stage: NoticeStage;
  noticeType: string | null;
  aboveThreshold: boolean | null;
  isFramework: boolean;
  status?: string | null;
}): NoticeBadgeKind {
  if (notice.noticeType === "UK12" || notice.status === "cancelled" || notice.status === "withdrawn" || notice.status === "unsuccessful") return "closed";
  switch (notice.stage) {
    case "planning":
      return "early";
    case "tender":
      if (notice.isFramework) return "framework";
      return notice.aboveThreshold === false ? "below_threshold" : "tender";
    case "award":
      return "award";
    case "contract":
      return "contract";
    case "market":
      return "market";
  }
}

export const NOTICE_BADGE_LABELS: Record<NoticeBadgeKind, string> = {
  tender: "Tender",
  below_threshold: "Below-threshold",
  framework: "Framework",
  early: "Early notice",
  award: "Award",
  contract: "Contract update",
  market: "Dynamic market",
  closed: "Closed",
};
