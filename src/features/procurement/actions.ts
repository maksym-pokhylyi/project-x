"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { dataRequests, suppliers } from "@/db/schema";
import { track } from "@/lib/analytics";
import { NotFoundError, ValidationError, type SerializedError } from "@/lib/errors";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, nameSchema, parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "@/server/http";
import { getUser, requireOrg } from "@/server/session";
import { cleanPagePath, composeDataRequest, DATA_ISSUE_KEYS, dataIssue } from "./domain/data-requests";
import type { RadarSpec } from "./domain/profile";
import { UK_REGIONS } from "./domain/regions";
import { cpvCodesForTrades } from "./domain/trades";
import { getMatchesForSpec } from "./queries/matches";
import { getSupplierSpec, specForManualProfile } from "./queries/shared";
import {
  applySourceOverrides,
  createRadarProfile,
  deleteRadarProfile,
  dismissFirstRun,
  getRadarItemStates,
  getRadarProfile,
  linkSupplier,
  listRadarSources,
  sameRegions,
  setRadarItemState,
  unlinkSupplier,
  updateRadarProfile,
  updateSupplierRadar,
  type RadarProfileInput,
  type RadarSource,
  type SupplierRadarInput,
} from "./radar/data";
import { cleanSelection, setupHref, type RadarSelection } from "./radar/selection";

/**
 * Server Actions of the procurement module. Each one starts from the session
 * (requireOrg) — the workspace is never taken from the form — validates what it is given
 * and runs inside runAction(), so an expected failure comes back as a message instead of
 * an error page. Actions that change product data ask for `write: true`: a workspace over
 * its seat limit is read-only.
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fields(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

/** Everything under /app shows saved state, counts or the active radar: refresh it all. */
function refreshApp(): void {
  revalidatePath("/app", "layout");
}

// --- claim -------------------------------------------------------------------------------------

/**
 * "Confirm and open my radar": links the signed-in workspace to a supplier, then opens its
 * radar on the first-run guide. The link is created here and only here — never by a GET —
 * and only with the "I am authorised to act for this company" box ticked.
 */
export async function claimSupplierAction(formData: FormData): Promise<void> {
  const supplierId = field(formData, "supplierId");
  const [supplier] = await db.select({ id: suppliers.id, slug: suppliers.slug, mergedInto: suppliers.mergedInto }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) redirect("/app/radar/find");
  const claimPage = `/claim/${supplier.slug}`;

  const result = await runAction("radar.claim", async () => {
    const ctx = await requireOrg({ write: true });
    if (field(formData, "authorised") !== "on") {
      throw new ValidationError("Tick the box to confirm that you are authorised to act for this company.", { authorised: ["Tick the box to confirm that you are authorised to act for this company."] });
    }
    const linked = await linkSupplier(ctx, supplier.id);
    if (linked.created) {
      await track("supplier_claimed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { supplier: supplier.mergedInto ?? supplier.id, method: linked.method });
    }
    return linked;
  });

  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect(`/sign-in?redirect=${encodeURIComponent(claimPage)}`);
    if (result.error.code === "QUOTA_EXCEEDED") redirect(`${claimPage}?limit=1`);
    if (result.error.code === "VALIDATION") redirect(`${claimPage}?confirm=missing`);
    redirect(`${claimPage}?problem=${result.error.code === "SEAT_LIMIT_REACHED" ? "read-only" : "failed"}`);
  }
  refreshApp();
  redirect(`/app?claimed=1&profile=${encodeURIComponent(`s:${supplier.mergedInto ?? supplier.id}`)}`);
}

// --- saved / dismissed ---------------------------------------------------------------------------

const tenderStateSchema = z.object({
  ocid: z.string().regex(/^ocds-[a-z0-9]{6}-[a-z0-9]{4,12}$/i, "Unknown tender."),
  state: z.enum(["saved", "dismissed"]).nullable(),
});

export type TenderState = z.infer<typeof tenderStateSchema>;

/**
 * Saves or dismisses a procurement for the caller's workspace; `state: null` clears either
 * (un-save, or undo a dismissal). Returns what was stored, so the screen can settle its
 * optimistic state — or the error, so it can roll back and say why.
 */
export async function setTenderStateAction(input: unknown): Promise<ActionResult<TenderState>> {
  return runAction("radar.item.set", async () => {
    const ctx = await requireOrg({ write: true });
    const data = parseInput(tenderStateSchema, input);
    await setRadarItemState(ctx, data.ocid, data.state);
    if (data.state === "saved") await track("tender_saved", { organizationId: ctx.organization.id, userId: ctx.user.id }, { ocid: data.ocid });
    if (data.state === "dismissed") await track("tender_dismissed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { ocid: data.ocid });
    refreshApp();
    return data;
  });
}

// --- trades and regions ------------------------------------------------------------------------

function numberOrNull(formData: FormData, name: string): number | null {
  const value = Number(field(formData, name));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The form's ticked trades (keys of the short list) and "more trades" (CPV codes) as one list of codes. */
function tradeCodes(formData: FormData): string[] {
  return [...new Set([...cpvCodesForTrades(fields(formData, "trade")), ...fields(formData, "cpv")])];
}

function profileInput(formData: FormData): RadarProfileInput {
  return {
    name: field(formData, "name"),
    cpvCodes: tradeCodes(formData),
    keywords: field(formData, "keywords").split(/[,\n]/),
    regions: fields(formData, "region"),
    valueMin: numberOrNull(formData, "valueMin"),
    valueMax: numberOrNull(formData, "valueMax"),
  };
}

/**
 * State of a radar form after a submit that did not go through. `selection` is what was
 * ticked, so the form can show it again; `attempt` changes with every submit (the form is
 * re-mounted with those ticks rather than reset to its first state).
 */
export type ProfileFormState = { error: SerializedError | null; selection?: RadarSelection; attempt?: number };

type SupplierSource = Extract<RadarSource, { kind: "supplier" }>;

/**
 * What the "Trades and regions" form says for a claimed company, as stored choices:
 *  - regions left exactly as the company's awards show them keep following the awards (null);
 *  - a trade read from its awards that is listed (`ownAll`) but not ticked (`own`) is switched off;
 *  - ticked trades of the short list and "more trades" are added.
 */
async function supplierChoices(current: SupplierSource, formData: FormData): Promise<SupplierRadarInput> {
  const derived = current.regionsOverride ?? (await getSupplierSpec(current.supplierId))?.regions ?? [];
  const chosen = fields(formData, "region");
  const ticked = new Set(fields(formData, "own"));
  // A form that does not list the company's own trades (an older page, a hand-made post) leaves them as they are.
  const listed = fields(formData, "ownAll");
  return {
    regions: sameRegions(chosen, derived) ? current.regionsOverride : chosen,
    extraCpvCodes: tradeCodes(formData),
    excludedCpvCodes: listed.length > 0 ? listed.filter((code) => !ticked.has(code)) : current.excludedCpvCodes,
  };
}

/**
 * "14 open tenders match these choices": the number of strong matches the form's current
 * ticks would give, without saving anything. Read-only, tenant-scoped (the source must be
 * one of the caller's own).
 */
export async function countRadarMatchesAction(formData: FormData): Promise<ActionResult<{ count: number }>> {
  return runAction("radar.profile.count", async () => {
    const ctx = await requireOrg();
    const source = field(formData, "source");
    const current = (await listRadarSources(ctx)).find((entry) => entry.key === source);
    let spec: RadarSpec | null = null;
    if (current?.kind === "supplier") {
      const base = await getSupplierSpec(current.supplierId);
      const choices = await supplierChoices(current, formData);
      spec = base ? applySourceOverrides(base, choices) : null;
    } else {
      // A manual radar being edited, or one not saved yet: its keywords and size band (if any) stay as stored.
      spec = specForManualProfile({
        id: current?.kind === "manual" ? current.profileId : "preview",
        name: "preview",
        cpvCodes: tradeCodes(formData),
        keywords: current?.kind === "manual" ? current.keywords : [],
        regions: fields(formData, "region").filter((region) => region in UK_REGIONS),
        valueMin: current?.kind === "manual" ? current.valueMin : null,
        valueMax: current?.kind === "manual" ? current.valueMax : null,
      });
    }
    if (!spec) return { count: 0 };
    const states = await getRadarItemStates(ctx);
    const dismissed = [...states].filter(([, state]) => state === "dismissed").map(([ocid]) => ocid);
    const result = await getMatchesForSpec(spec, { limit: 0, excludeOcids: dismissed });
    return { count: result.strong };
  });
}

/**
 * Stores the trades and regions a form posts and returns the key of the radar they belong to:
 *   - no `source`: creates a manually described radar (first-run guide follows);
 *   - `source` = "r:<profile id>": updates that manual profile;
 *   - `source` = "s:<supplier id>": stores the workspace's own regions, added trades and
 *     switched-off trades for a company it has claimed. Regions left as they were keep
 *     following the company's awards.
 */
async function saveRadarChoices(formData: FormData): Promise<ActionResult<string>> {
  // `profileId` is the older name of the field for a manual profile.
  const source = field(formData, "source") || (field(formData, "profileId") ? `r:${field(formData, "profileId")}` : "");
  return runAction("radar.profile.save", async () => {
    const ctx = await requireOrg({ write: true });
    const who = { organizationId: ctx.organization.id, userId: ctx.user.id };
    if (source.startsWith("s:")) {
      const supplierId = source.slice(2);
      const current = (await listRadarSources(ctx)).find((entry) => entry.key === source);
      if (!current || current.kind !== "supplier") throw new NotFoundError("That company is not on this workspace's radar.");
      await updateSupplierRadar(ctx, supplierId, await supplierChoices(current, formData));
      await track("radar_profile_saved", who, { source: "supplier", created: false });
      return source;
    }
    const input = profileInput(formData);
    if (source.startsWith("r:")) {
      // The "Trades and regions" form posts those two only: what it does not show stays as stored.
      const stored = await getRadarProfile(ctx, source.slice(2));
      if (!stored) throw new NotFoundError("That radar profile no longer exists.");
      await updateRadarProfile(ctx, stored.id, {
        ...input,
        name: formData.has("name") ? input.name : stored.name,
        keywords: formData.has("keywords") ? input.keywords : stored.keywords,
        valueMin: formData.has("valueMin") ? input.valueMin : stored.valueMin,
        valueMax: formData.has("valueMax") ? input.valueMax : stored.valueMax,
      });
      await track("radar_profile_saved", who, { source: "manual", created: false });
      return source;
    }
    const id = await createRadarProfile(ctx, input);
    await track("radar_profile_saved", who, { source: "manual", created: true });
    return `r:${id}`;
  });
}

/** Saves the trades and regions of a radar, then opens it (the page forms; works without script). */
export async function saveRadarProfileAction(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const result = await saveRadarChoices(formData);
  if (!result.ok) return { error: result.error };
  refreshApp();
  redirect(`/app?profile=${encodeURIComponent(result.data)}`);
}

/** The same save for the panel over the radar: it stays on the page and reports back, so the panel can close or show the error. */
export async function saveRadarChoicesAction(formData: FormData): Promise<ActionResult<{ source: string }>> {
  const result = await saveRadarChoices(formData);
  if (!result.ok) return result;
  refreshApp();
  return { ok: true, data: { source: result.data } };
}

/**
 * "Set up my radar" on the Find page, for a company with no notice to its name.
 * Signed in: creates the manual radar, exactly as the set-up page does.
 * Signed out: stores NOTHING — the selection travels in the address of the set-up page, by
 * way of sign-up; after the e-mail is confirmed that page opens pre-filled and one button
 * creates the radar.
 */
export async function setUpRadarAction(previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const selection = cleanSelection({ name: field(formData, "name"), trades: fields(formData, "trade"), cpv: fields(formData, "cpv"), regions: fields(formData, "region") });
  const attempt = (previous.attempt ?? 0) + 1;
  if (await getUser()) {
    const state = await saveRadarProfileAction(previous, formData);
    return { ...state, selection, attempt };
  }
  const fieldErrors: Record<string, string[]> = {};
  if (selection.name.length < 2) fieldErrors.name = ["Enter your company name."];
  if (tradeCodes(formData).length === 0) fieldErrors.cpvCodes = ["Tick at least one trade."];
  if (Object.keys(fieldErrors).length > 0) return { error: { code: "VALIDATION", message: "Please check the highlighted fields.", details: { fieldErrors } }, selection, attempt };
  const email = emailSchema.safeParse(field(formData, "email"));
  const target = new URLSearchParams({ redirect: setupHref(selection) });
  if (email.success) target.set("email", email.data);
  redirect(`/sign-up?${target.toString()}`);
}

/** "Hide this guide": the first-run screen stops showing for that radar. */
export async function dismissFirstRunAction(formData: FormData): Promise<void> {
  const key = field(formData, "key");
  await runAction("radar.first-run.dismiss", async () => {
    const ctx = await requireOrg({ write: true });
    await dismissFirstRun(ctx, key);
    await track("radar_first_run_dismissed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { source: key.startsWith("s:") ? "supplier" : "manual" });
  });
  refreshApp();
  redirect(`/app?tab=matches&profile=${encodeURIComponent(key)}`);
}

export async function removeRadarSourceAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg({ role: "admin", write: true });
  const key = field(formData, "key");
  if (key.startsWith("s:")) await unlinkSupplier(ctx, key.slice(2));
  else if (key.startsWith("r:")) await deleteRadarProfile(ctx, key.slice(2));
  refreshApp();
  redirect("/app");
}

// --- corrections and removals ----------------------------------------------------------------------

const dataRequestSchema = z
  .object({
    issue: z.enum(DATA_ISSUE_KEYS, "Choose what is wrong."),
    detail: z.string().trim().max(500, "Use at most 500 characters."),
    correction: z.string().trim().max(4000, "Use at most 4,000 characters."),
    evidence: z.union([z.literal(""), z.url("Enter a full link, starting with https://.").max(500)]),
    name: nameSchema,
    email: emailSchema,
    authorised: z.literal("on", "Tick the box to confirm that you work for this company or act for it."),
  })
  .superRefine((data, context) => {
    // A correction needs to say what is right; a request to hide something does not.
    if (dataIssue(data.issue)?.kind === "correction" && data.correction.length < 10) {
      context.addIssue({ code: "custom", path: ["correction"], message: "Tell us what it should say (at least 10 characters)." });
    }
    if (data.issue !== "hide_page" && data.detail.length < 3) {
      context.addIssue({ code: "custom", path: ["detail"], message: "Tell us which contract or detail you mean." });
    }
  });

/** `values` are the answers as typed, so a form that came back with an error shows them again; `attempt` changes with every submit. */
export type DataRequestState =
  | { status: "idle" }
  | { status: "sent"; page: string | null }
  | { status: "error"; error: SerializedError; values: Record<string, string>; attempt: number };

/**
 * "Flag a mistake". Public. A person reviews every request: nothing on a page changes here.
 * Five requests an hour from one address; a form that came back with errors is not counted,
 * so a missed tick does not use up a visitor's tries.
 */
export async function submitDataRequestAction(previous: DataRequestState, formData: FormData): Promise<DataRequestState> {
  const page = cleanPagePath(field(formData, "page"));
  const values = Object.fromEntries(["page", "issue", "detail", "correction", "evidence", "name", "email", "authorised"].map((name) => [name, field(formData, name).slice(0, 4000)]));
  const result: ActionResult<null> = await runAction("procurement.data-request", async () => {
    // Honeypot: real visitors never fill this hidden field.
    if (field(formData, "website")) return null;
    const data = parseInput(dataRequestSchema, {
      issue: field(formData, "issue"),
      detail: field(formData, "detail"),
      correction: field(formData, "correction"),
      evidence: field(formData, "evidence").trim(),
      name: field(formData, "name"),
      email: field(formData, "email"),
      authorised: field(formData, "authorised"),
    });
    await enforceRateLimit(`data-request:${clientIp(await headers())}`, { limit: 5, windowSeconds: 3600 });
    await db.insert(dataRequests).values({
      kind: dataIssue(data.issue)?.kind ?? "correction",
      requesterEmail: data.email,
      organisationName: null,
      pageUrl: page,
      message: composeDataRequest({ issue: data.issue, page, detail: data.detail, correction: data.correction, evidence: data.evidence, name: data.name, actsForCompany: true }),
    });
    return null;
  });
  return result.ok ? { status: "sent", page } : { status: "error", error: result.error, values, attempt: (previous.status === "error" ? previous.attempt : 0) + 1 };
}
