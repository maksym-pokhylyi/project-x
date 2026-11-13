"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { z } from "zod";
import { ValidationError, type SerializedError } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { runAction, type ActionResult } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { outreachConfig } from "./config";
import { segmentSchema, segmentToParams } from "./domain/segment";
import { SUPPRESSION_REASONS } from "./domain/suppression";
import { createCampaign } from "./server/builder";
import { clearSentMarks, discardCampaign, markProspectsSent } from "./server/campaigns";
import { resolveDataRequest } from "./server/data-requests";
import { flashError } from "./server/flash";
import { addSuppression, importBounceList, removeSuppression } from "./server/suppressions";

/**
 * Server Actions of the founder's outreach pages. Plain HTML forms post here and are sent
 * back to the page with a notice key or a signed error sentence in the address (see
 * server/flash.ts), so everything works without JavaScript. EVERY action checks requireAdmin() itself (a form on an admin page is not a
 * security boundary) and validates what it was sent; the functions it calls check again.
 *
 * None of these actions sends e-mail. There is no code path in this app that does so for outreach.
 */

const OUTREACH = "/admin/outreach";
const SUPPRESSIONS = "/admin/outreach/suppressions";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** The message a form shows: the first field error when there is one, otherwise the error's own message. */
function messageOf(error: SerializedError): string {
  const fieldErrors = error.details?.fieldErrors as Record<string, string[]> | undefined;
  const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
  return first ?? error.message;
}

/** `path` (which may carry a query and a #fragment) with `params` added to its query. */
function withParams(path: string, params: Record<string, string | number | undefined>): string {
  const [beforeHash = path, hash] = path.split("#");
  const [base = beforeHash, query = ""] = beforeHash.split("?");
  const search = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const out = search.toString();
  return `${base}${out ? `?${out}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Runs `body` as the founder. Signed out -> sign-in; anyone else -> 403; other failures come back as a result. */
async function asAdmin<T>(name: string, body: (adminId: string) => Promise<T>): Promise<ActionResult<T>> {
  const result = await runAction(`outreach.${name}`, async () => {
    const admin = await requireAdmin();
    return body(admin.id);
  });
  if (!result.ok && result.error.code === "UNAUTHORIZED") redirect(`/sign-in?redirect=${encodeURIComponent(OUTREACH)}`);
  if (!result.ok && result.error.code === "FORBIDDEN") forbidden();
  return result;
}

const uuid = z.uuid();

const createCampaignSchema = z.object({
  name: z.string().trim().min(3, "Give the campaign a name of 3 to 80 characters.").max(80, "Give the campaign a name of 3 to 80 characters."),
  templateVariant: z.string().regex(/^[a-z0-9_]{1,20}$/, "Choose one of the subject lines."),
  notes: z.string().max(2000, "Use at most 2,000 characters for notes.").optional(),
  segment: segmentSchema,
});

/** "Create campaign": builds the list again and stores it. The preview itself never stores anything. */
export async function createCampaignAction(formData: FormData): Promise<void> {
  let back = OUTREACH;
  const result = await asAdmin("campaign.create", async () => {
    let segmentInput: unknown = null;
    try {
      segmentInput = JSON.parse(text(formData, "segment"));
    } catch {
      segmentInput = null;
    }
    const segment = segmentSchema.safeParse(segmentInput);
    if (segment.success) back = `${OUTREACH}?${segmentToParams(segment.data).toString()}&preview=1`;
    const data = parseInput(createCampaignSchema, {
      name: text(formData, "name"),
      templateVariant: text(formData, "templateVariant"),
      notes: text(formData, "notes") || undefined,
      segment: segmentInput,
    });
    return createCampaign({ name: data.name, segment: data.segment, templateVariant: data.templateVariant, templateKey: outreachConfig.defaultTemplateKey, notes: data.notes });
  });
  if (!result.ok) redirect(withParams(back, flashError(messageOf(result.error))));
  revalidatePath(OUTREACH);
  redirect(withParams(`${OUTREACH}/campaigns/${result.data.campaignId}`, { notice: "created", n: result.data.listed }));
}

const tickedIds = (formData: FormData) => formData.getAll("ids").filter((value): value is string => typeof value === "string");
const selection = z.array(uuid).max(outreachConfig.batchSize.max);

const markSentSchema = z.object({
  campaignId: uuid,
  sentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the letters were sent."),
  scope: z.enum(["selected", "first_exported", "all_exported"]),
  ids: selection,
  count: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "Enter how many companies to mark as a whole number."),
});

/**
 * "Mark as sent": the legal record of first contact. Ticked rows, the first N exported rows
 * without a date (a day's batch, in the order of the exported file), or all of them.
 */
export async function markSentAction(formData: FormData): Promise<void> {
  const campaignId = text(formData, "campaignId");
  const back = uuid.safeParse(campaignId).success ? `${OUTREACH}/campaigns/${campaignId}` : OUTREACH;
  const result = await asAdmin("campaign.mark_sent", async () => {
    const data = parseInput(markSentSchema, { campaignId, sentOn: text(formData, "sentOn"), scope: text(formData, "scope") || "selected", ids: tickedIds(formData), count: text(formData, "count") });
    if (data.scope === "first_exported" && data.count === "") {
      throw new ValidationError(undefined, { count: ["Enter how many companies you wrote to, or tick the rows instead."] });
    }
    return markProspectsSent({
      campaignId: data.campaignId,
      sentOn: data.sentOn,
      prospectIds: data.scope === "selected" ? data.ids : undefined,
      allExported: data.scope === "all_exported",
      firstExported: data.scope === "first_exported" ? Number(data.count) : undefined,
    });
  });
  if (!result.ok) redirect(withParams(back, flashError(messageOf(result.error))));
  revalidatePath(back);
  const { marked, afterContactBy, notChanged, shortBy } = result.data;
  redirect(withParams(back, { notice: "sent", n: marked, late: afterContactBy || undefined, same: notChanged || undefined, short: shortBy || undefined }));
}

/** Undoes "mark as sent" for the ticked rows: the wrong rows, or the wrong day. Logged. */
export async function clearSentAction(formData: FormData): Promise<void> {
  const campaignId = text(formData, "campaignId");
  const back = uuid.safeParse(campaignId).success ? `${OUTREACH}/campaigns/${campaignId}` : OUTREACH;
  const result = await asAdmin("campaign.clear_sent", async () => {
    const data = parseInput(z.object({ campaignId: uuid, ids: selection }), { campaignId, ids: tickedIds(formData) });
    return clearSentMarks({ campaignId: data.campaignId, prospectIds: data.ids });
  });
  if (!result.ok) redirect(withParams(back, flashError(messageOf(result.error))));
  revalidatePath(back);
  redirect(withParams(back, { notice: "cleared", n: result.data.cleared, same: result.data.notChanged || undefined }));
}

/** Deletes a list that never left the tool. */
export async function discardCampaignAction(formData: FormData): Promise<void> {
  const campaignId = text(formData, "campaignId");
  const back = uuid.safeParse(campaignId).success ? `${OUTREACH}/campaigns/${campaignId}` : OUTREACH;
  const result = await asAdmin("campaign.discard", async () => discardCampaign(parseInput(uuid, campaignId)));
  if (!result.ok) redirect(withParams(back, flashError(messageOf(result.error))));
  revalidatePath(OUTREACH);
  redirect(withParams(OUTREACH, { notice: "discarded", n: result.data.discarded }));
}

const addSuppressionSchema = z.object({
  target: z.string().trim().min(3, "Enter an e-mail address, or a domain such as example.co.uk.").max(254),
  reason: z.enum(SUPPRESSION_REASONS),
  note: z.string().max(500, "Use at most 500 characters for the note.").optional(),
});

/** Adds one address or domain to the do-not-contact list. */
export async function addSuppressionAction(formData: FormData): Promise<void> {
  const result = await asAdmin("suppression.add", async () => {
    const data = parseInput(addSuppressionSchema, { target: text(formData, "target"), reason: text(formData, "reason") || "manual", note: text(formData, "note") || undefined });
    return addSuppression(data);
  });
  if (!result.ok) redirect(withParams(SUPPRESSIONS, flashError(messageOf(result.error))));
  revalidatePath(SUPPRESSIONS);
  redirect(withParams(SUPPRESSIONS, { notice: result.data.created ? "added" : "already", n: result.data.prospectsAffected || undefined }));
}

const MAX_UPLOAD_BYTES = 1_000_000;

/** Imports a bounce list: pasted text and/or an uploaded CSV or text file. */
export async function importBouncesAction(formData: FormData): Promise<void> {
  const result = await asAdmin("suppression.import", async () => {
    const parts = [text(formData, "list")];
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      parseInput(z.number().max(MAX_UPLOAD_BYTES, "That file is larger than 1 MB. Import it in parts."), file.size);
      parts.push(await file.text());
    }
    return importBounceList(parts.join("\n"));
  });
  if (!result.ok) redirect(withParams(SUPPRESSIONS, flashError(messageOf(result.error))));
  revalidatePath(SUPPRESSIONS);
  const { added, alreadyListed, ignoredOwn, truncated } = result.data;
  redirect(withParams(SUPPRESSIONS, { notice: "imported", n: added, same: alreadyListed || undefined, own: ignoredOwn || undefined, cut: truncated ? 1 : undefined }));
}

const removeSuppressionSchema = z.object({ id: uuid, confirmation: z.string().trim().min(1, "Type the address or domain exactly as shown to remove it.").max(254) });

/** Takes an entry off the list. Needs the address or domain typed out, and is logged. */
export async function removeSuppressionAction(formData: FormData): Promise<void> {
  const result = await asAdmin("suppression.remove", async () => removeSuppression(parseInput(removeSuppressionSchema, { id: text(formData, "id"), confirmation: text(formData, "confirmation") })));
  if (!result.ok) redirect(withParams(SUPPRESSIONS, flashError(messageOf(result.error))));
  revalidatePath(SUPPRESSIONS);
  redirect(withParams(SUPPRESSIONS, { notice: "removed" }));
}

const resolveRequestSchema = z.object({ id: uuid, action: z.enum(["done", "rejected", "hide_page", "erase_contact"]) });

/** Closes a correction/removal request, optionally hiding the company page or erasing the contact details. */
export async function resolveDataRequestAction(formData: FormData): Promise<void> {
  const result = await asAdmin("data_request.resolve", async () => resolveDataRequest(parseInput(resolveRequestSchema, { id: text(formData, "id"), action: text(formData, "action") })));
  if (!result.ok) redirect(withParams(`${SUPPRESSIONS}#requests`, flashError(messageOf(result.error))));
  // A hidden page must disappear now, not when the hourly cache of public pages expires.
  if (result.data.pageHidden) revalidateTag("procurement", { expire: 0 });
  revalidatePath(SUPPRESSIONS);
  redirect(withParams(`${SUPPRESSIONS}#requests`, { notice: result.data.pageHidden ? "page_hidden" : result.data.prospectsErased + result.data.contactsDeleted > 0 ? "erased" : "request_closed" }));
}
