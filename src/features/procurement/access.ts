import type { Entitlements } from "@/lib/billing/entitlements";
import { procurementConfig } from "./config";

/**
 * Plan gating for the Radar — the ONLY place the procurement module reads entitlements.
 *
 * Keys (wired into the plan catalogue by the lead):
 *   features["radar.full"]    boolean  full radar: every match, no cap
 *   limits["radar.profiles"]  number   how many radar sources (claimed companies + manual
 *                                      profiles) a workspace may have; null = unlimited
 * While the keys are absent every workspace gets the Free behaviour: top 10 matches and
 * one profile.
 */
export type RadarAccess = {
  /** Paid radar: all matches visible. */
  full: boolean;
  /** Matches shown in full; null = no cap. */
  matchLimit: number | null;
  /** Radar sources allowed; null = unlimited. */
  maxProfiles: number | null;
  planName: string;
};

const FREE_PROFILES = 1;
const PAID_PROFILES_DEFAULT = 5;

export function radarAccess(entitlements: Pick<Entitlements, "features" | "limits" | "plan">): RadarAccess {
  const features = entitlements.features as unknown as Record<string, unknown>;
  const limits = entitlements.limits as unknown as Record<string, unknown>;
  const full = features["radar.full"] === true;
  const configured = limits["radar.profiles"];
  const maxProfiles = configured === null ? null : typeof configured === "number" && configured >= 0 ? Math.floor(configured) : full ? PAID_PROFILES_DEFAULT : FREE_PROFILES;
  return {
    full,
    matchLimit: full ? null : procurementConfig.freeMatchLimit,
    maxProfiles,
    planName: entitlements.plan.name,
  };
}

/** True when another radar source may be added. */
export function canAddRadarSource(access: RadarAccess, currentSources: number): boolean {
  return access.maxProfiles === null || currentSources < access.maxProfiles;
}
