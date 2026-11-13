import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orgSupplierLinks, radarItems, radarProfiles, supplierContacts, suppliers } from "@/db/schema";
import { ConflictError, NotFoundError, QuotaExceededError, ValidationError } from "@/lib/errors";
import type { OrgContext } from "@/server/session";
import { canAddRadarSource, radarAccess } from "../access";
import { isCpvCode } from "../domain/cpv";
import { isFreemailDomain } from "../domain/normalize";
import type { RadarSpec } from "../domain/profile";
import { UK_REGIONS } from "../domain/regions";
import { getNoticeCardsByOcid } from "../queries/notices";
import { getSupplierSpec, specForManualProfile, type NoticeCard } from "../queries/shared";

/**
 * Tenant data access for the Radar. EVERY function takes the OrgContext from
 * requireOrg()/requireOrgForPage() and filters on ctx.organization.id — the organization
 * never comes from a URL, a form field or a request body.
 */

export type RadarSource =
  | { kind: "supplier"; key: string; supplierId: string; name: string; slug: string; awardsCount: number; linkId: string }
  | { kind: "manual"; key: string; profileId: string; name: string; cpvCodes: string[]; keywords: string[]; regions: string[]; valueMin: number | null; valueMax: number | null };

/** The workspace's radar sources: claimed companies first (oldest first), then manual profiles. */
export async function listRadarSources(ctx: OrgContext): Promise<RadarSource[]> {
  const [links, profiles] = await Promise.all([
    db
      .select({ linkId: orgSupplierLinks.id, supplierId: suppliers.id, name: suppliers.name, slug: suppliers.slug, awardsCount: suppliers.awardsCount })
      .from(orgSupplierLinks)
      .innerJoin(suppliers, eq(suppliers.id, orgSupplierLinks.supplierId))
      .where(eq(orgSupplierLinks.organizationId, ctx.organization.id))
      .orderBy(asc(orgSupplierLinks.createdAt)),
    db.select().from(radarProfiles).where(eq(radarProfiles.organizationId, ctx.organization.id)).orderBy(asc(radarProfiles.createdAt)),
  ]);
  return [
    ...links.map((link): RadarSource => ({ kind: "supplier", key: `s:${link.supplierId}`, supplierId: link.supplierId, name: link.name, slug: link.slug, awardsCount: link.awardsCount, linkId: link.linkId })),
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
      }),
    ),
  ];
}

/** The spec to match against for one of the workspace's own sources. */
export async function specForSource(source: RadarSource): Promise<RadarSpec | null> {
  if (source.kind === "supplier") return getSupplierSpec(source.supplierId);
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
    .values({ organizationId: ctx.organization.id, supplierId: targetId, createdBy: ctx.user.id, method })
    .onConflictDoNothing()
    .returning({ id: orgSupplierLinks.id });
  return { created: inserted.length > 0, method };
}

export async function unlinkSupplier(ctx: OrgContext, supplierId: string): Promise<void> {
  await db.delete(orgSupplierLinks).where(and(eq(orgSupplierLinks.organizationId, ctx.organization.id), eq(orgSupplierLinks.supplierId, supplierId)));
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
    .values({ ...data, organizationId: ctx.organization.id, createdBy: ctx.user.id })
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
