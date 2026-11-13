"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { dataRequests, suppliers } from "@/db/schema";
import { track } from "@/lib/analytics";
import { AppError, type SerializedError } from "@/lib/errors";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "@/server/http";
import { requireOrg } from "@/server/session";
import { createRadarProfile, deleteRadarProfile, linkSupplier, setRadarItemState, unlinkSupplier, updateRadarProfile, type RadarProfileInput } from "./radar/data";

/**
 * Server Actions of the procurement module. Each one starts from the session
 * (requireOrg) — the workspace is never taken from the form.
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** "Claim this page": links the signed-in workspace to a supplier, then opens its radar. */
export async function claimSupplierAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const supplierId = field(formData, "supplierId");
  const [supplier] = await db.select({ id: suppliers.id, slug: suppliers.slug, mergedInto: suppliers.mergedInto }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) redirect("/app/radar/find");
  let target = `/app?claimed=1&profile=${encodeURIComponent(`s:${supplier.mergedInto ?? supplier.id}`)}`;
  try {
    const result = await linkSupplier(ctx, supplier.id);
    if (result.created) {
      await track("supplier_claimed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { supplier: supplier.mergedInto ?? supplier.id, method: result.method });
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "QUOTA_EXCEEDED") target = `/claim/${supplier.slug}?limit=1`;
    else throw error;
  }
  revalidatePath("/app");
  redirect(target);
}

export async function saveTenderAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const ocid = field(formData, "ocid");
  await setRadarItemState(ctx, ocid, "saved");
  await track("tender_saved", { organizationId: ctx.organization.id, userId: ctx.user.id }, { ocid });
  revalidatePath("/app");
}

export async function dismissTenderAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  const ocid = field(formData, "ocid");
  await setRadarItemState(ctx, ocid, "dismissed");
  await track("tender_dismissed", { organizationId: ctx.organization.id, userId: ctx.user.id }, { ocid });
  revalidatePath("/app");
}

/** Removes the saved / dismissed state. */
export async function clearTenderStateAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg();
  await setRadarItemState(ctx, field(formData, "ocid"), null);
  revalidatePath("/app");
}

function profileInput(formData: FormData): RadarProfileInput {
  const numberOrNull = (name: string) => {
    const value = Number(field(formData, name));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  return {
    name: field(formData, "name"),
    cpvCodes: formData.getAll("cpv").filter((value): value is string => typeof value === "string"),
    keywords: field(formData, "keywords").split(/[,\n]/),
    regions: formData.getAll("region").filter((value): value is string => typeof value === "string"),
    valueMin: numberOrNull("valueMin"),
    valueMax: numberOrNull("valueMax"),
  };
}

export type ProfileFormState = { error: SerializedError | null };

/** Creates (or, with `profileId`, updates) a manual radar profile, then opens the radar. */
export async function saveRadarProfileAction(_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const profileId = field(formData, "profileId");
  const result = await runAction("radar.profile.save", async () => {
    const ctx = await requireOrg();
    const input = profileInput(formData);
    if (profileId) {
      await updateRadarProfile(ctx, profileId, input);
      return profileId;
    }
    return createRadarProfile(ctx, input);
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/app");
  redirect(`/app?profile=${encodeURIComponent(`r:${result.data}`)}`);
}

export async function removeRadarSourceAction(formData: FormData): Promise<void> {
  const ctx = await requireOrg({ role: "admin" });
  const key = field(formData, "key");
  if (key.startsWith("s:")) await unlinkSupplier(ctx, key.slice(2));
  else if (key.startsWith("r:")) await deleteRadarProfile(ctx, key.slice(2));
  revalidatePath("/app");
  redirect("/app");
}

const dataRequestSchema = z.object({
  kind: z.enum(["correction", "removal", "other"]),
  email: emailSchema,
  organisationName: z.string().trim().max(200).optional(),
  pageUrl: z.string().trim().max(500).optional(),
  message: z.string().trim().min(10, "Tell us what should change (at least 10 characters).").max(4000, "Use at most 4,000 characters."),
});

export type DataRequestState = { status: "idle" | "sent" } | { status: "error"; error: SerializedError };

/** "Request a correction or removal" on /about-the-data. Public; rate-limited per address. */
export async function submitDataRequestAction(_previous: DataRequestState, formData: FormData): Promise<DataRequestState> {
  const result: ActionResult<null> = await runAction("procurement.data-request", async () => {
    // Honeypot: real visitors never fill this hidden field.
    if (field(formData, "website")) return null;
    await enforceRateLimit(`data-request:${clientIp(await headers())}`, { limit: 5, windowSeconds: 3600 });
    const data = parseInput(dataRequestSchema, {
      kind: field(formData, "kind") || "correction",
      email: field(formData, "email"),
      organisationName: field(formData, "organisationName") || undefined,
      pageUrl: field(formData, "pageUrl") || undefined,
      message: field(formData, "message"),
    });
    await db.insert(dataRequests).values({ kind: data.kind, requesterEmail: data.email, organisationName: data.organisationName ?? null, pageUrl: data.pageUrl ?? null, message: data.message });
    return null;
  });
  return result.ok ? { status: "sent" } : { status: "error", error: result.error };
}
