import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, libraryDocs, orgSupplierLinks, radarItems, radarProfiles, supplierContacts, suppliers } from "@/db/schema";
import { ConflictError, NotFoundError, QuotaExceededError, ValidationError } from "@/lib/errors";
import type { OrgContext } from "@/server/session";
import { canAddRadarSource, radarAccess } from "../access";
import { cpvPrefixes, cpvStem, isCpvCode } from "../domain/cpv";
import { isFreemailDomain } from "../domain/normalize";
import { tradeLevels, type RadarSpec } from "../domain/profile";
import { NATIONWIDE, UK_REGIONS } from "../domain/regions";
import { getNoticeCardsByOcid } from "../queries/notices";
import { getSupplierSpec, specForManualProfile, type NoticeCard } from "../queries/shared";

/**
 * Tenant data access for the Radar. EVERY function takes the OrgContext from
 * requireOrg()/requireOrgForPage() and filters on ctx.organization.id — the organization
 * never comes from a URL, a form field or a request body.
 */

export type RadarSource =
  | {
      kind: "supplier";
      key: string;
      supplierId: string;
      name: string;
      slug: string;
      awardsCount: number;
      linkId: string;
      /** The workspace's own regions for this radar; null = the regions of the company's awards. */
      regionsOverride: string[] | null;
      /** Trades the workspace added to the ones the company's awards show. */
      extraCpvCodes: string[];
      /** Trades the company's awards show that the workspace switched off. */
      excludedCpvCodes: string[];
      firstRunPending: boolean;
    }
  | {
      kind: "manual";
      key: string;
      profileId: string;
      name: string;
      cpvCodes: string[];
      keywords: string[];
      regions: string[];
      valueMin: number | null;
      valueMax: number | null;
      firstRunPending: boolean;
    };

/** The workspace's radar sources: claimed companies first (oldest first), then manual profiles. */
export async function listRadarSources(ctx: OrgContext): Promise<RadarSource[]> {
  const [links, profiles] = await Promise.all([
    db
      .select({
        linkId: orgSupplierLinks.id,
        supplierId: suppliers.id,
        name: suppliers.name,
        slug: suppliers.slug,
        awardsCount: suppliers.awardsCount,
        regions: orgSupplierLinks.regions,
        extraCpvCodes: orgSupplierLinks.extraCpvCodes,
        excludedCpvCodes: orgSupplierLinks.excludedCpvCodes,
        firstRunPending: orgSupplierLinks.firstRunPending,
      })
      .from(orgSupplierLinks)
      .innerJoin(suppliers, eq(suppliers.id, orgSupplierLinks.supplierId))
      .where(eq(orgSupplierLinks.organizationId, ctx.organization.id))
      .orderBy(asc(orgSupplierLinks.createdAt)),
    db.select().from(radarProfiles).where(eq(radarProfiles.organizationId, ctx.organization.id)).orderBy(asc(radarProfiles.createdAt)),
  ]);
  return [
    ...links.map(
      (link): RadarSource => ({
        kind: "supplier",
        key: `s:${link.supplierId}`,
        supplierId: link.supplierId,
        name: link.name,
        slug: link.slug,
        awardsCount: link.awardsCount,
        linkId: link.linkId,
        regionsOverride: link.regions,
        extraCpvCodes: link.extraCpvCodes,
        excludedCpvCodes: link.excludedCpvCodes,
        firstRunPending: link.firstRunPending,
      }),
    ),
    ...profiles.map(
      (profile): RadarSource => ({
        kind: "manual",
        key: `r:${profile.id}`,
        profileId: profile.id,
        name: profile.name,
        cpvCodes: profile.cpvCodes,
        keywords: profile.keywords,
        regions: profile.regions,
        valueMin: profile.valueMin,
        valueMax: profile.valueMax,
        firstRunPending: profile.firstRunPending,
      }),
    ),
  ];
}

export type SourceOverrides = { regions: string[] | null; extraCpvCodes: readonly string[]; excludedCpvCodes?: readonly string[] };

/**
 * A company's spec with the workspace's own adjustments applied (PURE):
 *  - chosen regions replace the ones its awards show;
 *  - trades it switched off stop counting — the trade itself, every code beneath it, and
 *    as much of the broader codes above it as rested on it;
 *  - trades it added count fully at each of their depths and are its trade at exactly the
 *    depth chosen (`chosen`), as in a manually described radar.
 * With no adjustments the spec comes back unchanged, so a radar nobody has edited matches
 * exactly as the company's public page does.
 */
export function applySourceOverrides(spec: RadarSpec, overrides: SourceOverrides): RadarSpec {
  const extra = overrides.extraCpvCodes.filter(isCpvCode);
  const muted = [...new Set((overrides.excludedCpvCodes ?? []).filter(isCpvCode).map(cpvStem))];
  if (overrides.regions === null && extra.length === 0 && muted.length === 0) return spec;

  const isMuted = (prefix: string) => muted.some((stem) => prefix.startsWith(stem));
  const cpvWeights: Record<string, number> = {};
  for (const [prefix, weight] of Object.entries(spec.cpvWeights)) if (!isMuted(prefix)) cpvWeights[prefix] = weight;
  // A broader code keeps only the weight of what is left beneath it; with nothing left it goes too.
  for (const stem of muted) {
    for (let length = stem.length - 1; length >= 2; length -= 1) {
      const parent = stem.slice(0, length);
      if (!(parent in cpvWeights)) continue;
      const beneath = Object.entries(cpvWeights).filter(([prefix]) => prefix.length > length && prefix.startsWith(parent));
      if (beneath.length === 0) delete cpvWeights[parent];
      else cpvWeights[parent] = Math.min(cpvWeights[parent]!, Math.max(...beneath.map(([, weight]) => weight)));
    }
  }
  const own = spec.trades ?? tradeLevels(spec.cpvWeights);
  const trades = { classes: own.classes.filter((level) => !isMuted(level)), groups: own.groups.filter((level) => !isMuted(level)), divisions: own.divisions.filter((level) => !isMuted(level)) };

  for (const code of extra) for (const prefix of cpvPrefixes(code)) cpvWeights[prefix] = 1;
  const prefixes = Object.keys(cpvWeights);
  return {
    ...spec,
    cpvWeights,
    cpvDivisions: prefixes.filter((prefix) => prefix.length === 2),
    cpvGroups: [...new Set([...spec.cpvGroups.filter((group) => group in cpvWeights), ...extra.flatMap((code) => cpvPrefixes(code)).filter((prefix) => prefix.length === 3)])],
    regions: overrides.regions ?? spec.regions,
    trades,
    chosen: [...new Set([...(spec.chosen ?? []), ...extra.map(cpvStem)])],
  };
}

/** The spec to match against for one of the workspace's own sources. */
export async function specForSource(source: RadarSource): Promise<RadarSpec | null> {
  if (source.kind === "supplier") {
    const spec = await getSupplierSpec(source.supplierId);
    return spec ? applySourceOverrides(spec, { regions: source.regionsOverride, extraCpvCodes: source.extraCpvCodes, excludedCpvCodes: source.excludedCpvCodes }) : null;
  }
  return specForManualProfile({ id: source.profileId, name: source.name, cpvCodes: source.cpvCodes, keywords: source.keywords, regions: source.regions, valueMin: source.valueMin, valueMax: source.valueMax });
}

/**
 * Picks the active source: the one named by `selectedKey` if it belongs to this workspace
 * (a key from another workspace is simply ignored), otherwise the first.
 */
export function pickSource(sources: RadarSource[], selectedKey: string | null | undefined): RadarSource | null {
  return sources.find((source) => source.key === selectedKey) ?? sources[0] ?? null;
}

/** Whether this workspace has claimed the supplier. */
export async function hasSupplierLink(ctx: OrgContext, supplierId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orgSupplierLinks.id })
    .from(orgSupplierLinks)
    .where(and(eq(orgSupplierLinks.organizationId, ctx.organization.id), eq(orgSupplierLinks.supplierId, supplierId)));
  return Boolean(row);
}

/**
 * Links the workspace to a supplier ("claim"). Idempotent. Enforces the plan's profile
 * limit. `method` records whether the claimant's e-mail domain matches a domain the
 * supplier published (a hint, not proof of authority).
 */
export async function linkSupplier(ctx: OrgContext, supplierId: string): Promise<{ created: boolean; method: string }> {
  const [supplier] = await db.select({ id: suppliers.id, mergedInto: suppliers.mergedInto, removedAt: suppliers.removedAt, website: suppliers.website }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier || supplier.removedAt) throw new NotFoundError("We could not find that company.");
  const targetId = supplier.mergedInto ?? supplier.id;
  if (await hasSupplierLink(ctx, targetId)) return { created: false, method: "existing" };

  const sources = await listRadarSources(ctx);
  const access = radarAccess(ctx.entitlements);
  if (!canAddRadarSource(access, sources.length)) throw new QuotaExceededError("radar profiles", access.maxProfiles ?? 0, sources.length);

  const emailDomain = ctx.user.email.split("@")[1]?.toLowerCase() ?? "";
  let method = "self_declared";
  if (emailDomain && !isFreemailDomain(emailDomain)) {
    const [match] = await db
      .select({ id: supplierContacts.id })
      .from(supplierContacts)
      .where(and(eq(supplierContacts.supplierId, targetId), eq(supplierContacts.emailDomain, emailDomain)))
      .limit(1);
    if (match || supplier.website === emailDomain) method = "email_domain";
  }
  const inserted = await db
    .insert(orgSupplierLinks)
    .values({ organizationId: ctx.organization.id, supplierId: targetId, createdBy: ctx.user.id, method, firstRunPending: true })
    .onConflictDoNothing()
    .returning({ id: orgSupplierLinks.id });
  return { created: inserted.length > 0, method };
}

export async function unlinkSupplier(ctx: OrgContext, supplierId: string): Promise<void> {
  await db.delete(orgSupplierLinks).where(and(eq(orgSupplierLinks.organizationId, ctx.organization.id), eq(orgSupplierLinks.supplierId, supplierId)));
}

export type SupplierRadarInput = {
  /** Chosen top-level regions; null keeps following the company's awards, an empty list means anywhere in the UK. */
  regions: string[] | null;
  /** Trades added to the ones the company's awards show. */
  extraCpvCodes: string[];
  /** Trades its awards show that the workspace switched off. */
  excludedCpvCodes: string[];
};

/**
 * Stores a workspace's own regions and trades for a company it has claimed. The company's
 * public page and every other workspace's radar are untouched.
 */
export async function updateSupplierRadar(ctx: OrgContext, supplierId: string, input: SupplierRadarInput): Promise<void> {
  const regions = input.regions === null ? null : [...new Set(input.regions.filter((region) => region in UK_REGIONS))];
  const extraCpvCodes = [...new Set(input.extraCpvCodes.filter(isCpvCode))].slice(0, 40);
  const excludedCpvCodes = [...new Set(input.excludedCpvCodes.filter(isCpvCode))].slice(0, 40);
  const updated = await db
    .update(orgSupplierLinks)
    .set({ regions, extraCpvCodes, excludedCpvCodes })
    .where(and(eq(orgSupplierLinks.organizationId, ctx.organization.id), eq(orgSupplierLinks.supplierId, supplierId)))
    .returning({ id: orgSupplierLinks.id });
  if (updated.length === 0) throw new NotFoundError("That company is not on this workspace's radar.");
}

/** True when two region selections are the same set. "UK" (works nationwide) is not a tick box, so it is ignored. */
export function sameRegions(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.filter((region) => region !== NATIONWIDE));
  const right = new Set(b.filter((region) => region !== NATIONWIDE));
  return left.size === right.size && [...left].every((region) => right.has(region));
}

export type RadarProfileInput = { name: string; cpvCodes: string[]; keywords: string[]; regions: string[]; valueMin: number | null; valueMax: number | null };

function cleanProfileInput(input: RadarProfileInput): RadarProfileInput {
  const name = input.name.trim().slice(0, 80);
  const cpvCodes = [...new Set(input.cpvCodes.filter(isCpvCode))].slice(0, 30);
  const keywords = [...new Set(input.keywords.map((keyword) => keyword.trim().toLowerCase().replace(/\s+/g, " ")).filter((keyword) => keyword.length >= 3 && keyword.length <= 60))].slice(0, 20);
  const regions = [...new Set(input.regions.filter((region) => region in UK_REGIONS))];
  const fieldErrors: Record<string, string[]> = {};
  if (name.length < 2) fieldErrors.name = ["Give this radar a name, for example your company name."];
  if (cpvCodes.length === 0 && keywords.length === 0) fieldErrors.cpvCodes = ["Choose at least one trade or add a keyword."];
  const valueMin = input.valueMin !== null && input.valueMin > 0 ? input.valueMin : null;
  const valueMax = input.valueMax !== null && input.valueMax > 0 ? input.valueMax : null;
  if (valueMin !== null && valueMax !== null && valueMin > valueMax) fieldErrors.valueMax = ["The largest contract must be bigger than the smallest."];
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(undefined, fieldErrors);
  return { name, cpvCodes, keywords, regions, valueMin, valueMax };
}

export async function createRadarProfile(ctx: OrgContext, input: RadarProfileInput): Promise<string> {
  const data = cleanProfileInput(input);
  const sources = await listRadarSources(ctx);
  const access = radarAccess(ctx.entitlements);
  if (!canAddRadarSource(access, sources.length)) throw new QuotaExceededError("radar profiles", access.maxProfiles ?? 0, sources.length);
  const [row] = await db
    .insert(radarProfiles)
    .values({ ...data, organizationId: ctx.organization.id, createdBy: ctx.user.id, firstRunPending: true })
    .returning({ id: radarProfiles.id });
  if (!row) throw new ConflictError("Could not save the radar profile.");
  return row.id;
}

export async function updateRadarProfile(ctx: OrgContext, profileId: string, input: RadarProfileInput): Promise<void> {
  const data = cleanProfileInput(input);
  const updated = await db
    .update(radarProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(radarProfiles.id, profileId), eq(radarProfiles.organizationId, ctx.organization.id)))
    .returning({ id: radarProfiles.id });
  if (updated.length === 0) throw new NotFoundError("That radar profile no longer exists.");
}

export async function deleteRadarProfile(ctx: OrgContext, profileId: string): Promise<void> {
  await db.delete(radarProfiles).where(and(eq(radarProfiles.id, profileId), eq(radarProfiles.organizationId, ctx.organization.id)));
}

export async function getRadarProfile(ctx: OrgContext, profileId: string) {
  const [row] = await db
    .select()
    .from(radarProfiles)
    .where(and(eq(radarProfiles.id, profileId), eq(radarProfiles.organizationId, ctx.organization.id)));
  return row ?? null;
}

// --- first run -------------------------------------------------------------------------------

/**
 * The three things the first-run guide asks for, and how the workspace is seen to have done
 * each one:
 *   1 profile     it saved its trades and regions       — our own event
 *   2 documents   it has a document in its library      — a row of its own in library_docs
 *   3 check       it started a bid check                — the bid desk's event (SPEC §7)
 * The guide ends when all three are done, or when it is hidden.
 */
export const FIRST_RUN_STEP_EVENTS: Record<"profile" | "check", readonly string[]> = {
  profile: ["radar_profile_saved"],
  check: ["bid_created"],
};

export type FirstRunSteps = { profile: boolean; documents: boolean; check: boolean };

/** Which first-run steps the workspace has completed. */
export async function getFirstRunSteps(ctx: OrgContext): Promise<FirstRunSteps> {
  const names = [...new Set(Object.values(FIRST_RUN_STEP_EVENTS).flat())];
  const [rows, documents] = await Promise.all([
    db
      .selectDistinct({ name: events.name })
      .from(events)
      .where(and(eq(events.organizationId, ctx.organization.id), inArray(events.name, names))),
    db.select({ id: libraryDocs.id }).from(libraryDocs).where(eq(libraryDocs.organizationId, ctx.organization.id)).limit(1),
  ]);
  const seen = new Set(rows.map((row) => row.name));
  const done = (step: keyof typeof FIRST_RUN_STEP_EVENTS) => FIRST_RUN_STEP_EVENTS[step].some((name) => seen.has(name));
  return { profile: done("profile"), documents: documents.length > 0, check: done("check") };
}

/** Stops showing the first-run guide for one of the workspace's radar sources ("s:<supplier id>" or "r:<profile id>"). */
export async function dismissFirstRun(ctx: OrgContext, key: string): Promise<void> {
  if (key.startsWith("s:")) {
    await db
      .update(orgSupplierLinks)
      .set({ firstRunPending: false })
      .where(and(eq(orgSupplierLinks.organizationId, ctx.organization.id), eq(orgSupplierLinks.supplierId, key.slice(2))));
  } else if (key.startsWith("r:") && /^[0-9a-f-]{36}$/i.test(key.slice(2))) {
    await db
      .update(radarProfiles)
      .set({ firstRunPending: false })
      .where(and(eq(radarProfiles.organizationId, ctx.organization.id), eq(radarProfiles.id, key.slice(2))));
  }
}

// --- saved / dismissed ---------------------------------------------------------------------

export type RadarItemState = "saved" | "dismissed";

/** ocid -> state for everything this workspace has saved or dismissed. */
export async function getRadarItemStates(ctx: OrgContext): Promise<Map<string, RadarItemState>> {
  const rows = await db.select({ ocid: radarItems.ocid, state: radarItems.state }).from(radarItems).where(eq(radarItems.organizationId, ctx.organization.id));
  return new Map(rows.map((row) => [row.ocid, row.state as RadarItemState]));
}

/** Saves or dismisses a procurement for the workspace; `null` clears the state. */
export async function setRadarItemState(ctx: OrgContext, ocid: string, state: RadarItemState | null): Promise<void> {
  if (!/^ocds-[a-z0-9]{6}-[a-z0-9]{4,12}$/i.test(ocid)) throw new ValidationError("Unknown tender.");
  if (state === null) {
    await db.delete(radarItems).where(and(eq(radarItems.organizationId, ctx.organization.id), eq(radarItems.ocid, ocid)));
    return;
  }
  const [exists] = await db.execute<{ one: number }>(sql`select 1 as one from notices where ocid = ${ocid} limit 1`);
  if (!exists) throw new NotFoundError("That tender is no longer listed.");
  await db
    .insert(radarItems)
    .values({ organizationId: ctx.organization.id, ocid, state, createdBy: ctx.user.id })
    .onConflictDoUpdate({ target: [radarItems.organizationId, radarItems.ocid], set: { state, updatedAt: new Date() } });
}

/** The workspace's saved tenders as notice cards, soonest deadline first. */
export async function getSavedTenders(ctx: OrgContext): Promise<NoticeCard[]> {
  const rows = await db
    .select({ ocid: radarItems.ocid })
    .from(radarItems)
    .where(and(eq(radarItems.organizationId, ctx.organization.id), eq(radarItems.state, "saved")));
  const cards = await getNoticeCardsByOcid(rows.map((row) => row.ocid));
  return cards.sort((a, b) => (a.deadlineAt ?? "9999").localeCompare(b.deadlineAt ?? "9999"));
}
