"use server";

import { revalidatePath } from "next/cache";
import { nudgeWorker } from "@/features/bids/server/pipeline/dispatch";
import { storageBackend } from "@/lib/storage";
import { runAction, type ActionResult } from "@/server/http";
import { requireOrg } from "@/server/session";
import { deleteLibraryDoc, planLibraryUpload, registerLibraryDoc, updateLibraryDoc } from "./server/docs";
import { discardFactsDraft, draftCompanyFactsFromWebsite, saveCompanyFacts } from "./server/facts";

/** Server Actions of the evidence library. The workspace always comes from the session. */

export async function saveCompanyFactsAction(input: unknown): Promise<ActionResult<{ confirmedAt: string }>> {
  return runAction("library.facts.save", async () => {
    const ctx = await requireOrg({ write: true });
    const record = await saveCompanyFacts(ctx, input);
    revalidatePath("/app/library");
    return { confirmedAt: (record.confirmedAt ?? new Date()).toISOString() };
  });
}

/** Reads the company's website and stores a DRAFT for review. Never confirms anything. */
export async function draftFactsFromWebsiteAction(url: string): Promise<ActionResult<{ pages: number }>> {
  return runAction("library.facts.draft", async () => {
    const ctx = await requireOrg({ write: true });
    const result = await draftCompanyFactsFromWebsite(ctx, url);
    revalidatePath("/app/library");
    return { pages: result.pages.length };
  });
}

export async function discardFactsDraftAction(): Promise<ActionResult> {
  return runAction("library.facts.discard_draft", async () => {
    const ctx = await requireOrg({ write: true });
    await discardFactsDraft(ctx);
    revalidatePath("/app/library");
    return undefined;
  });
}

export type LibraryUploadTarget = { docId: string; pathname: string; contentType: string; mode: "blob" | "direct"; directUrl: string };

export async function planLibraryUploadAction(file: { name: string; size: number }): Promise<ActionResult<LibraryUploadTarget>> {
  return runAction("library.plan_upload", async () => {
    const ctx = await requireOrg({ write: true });
    const plan = await planLibraryUpload(ctx, file);
    return {
      docId: plan.docId,
      pathname: plan.storageKey,
      contentType: plan.contentType,
      mode: storageBackend === "vercel-blob" ? ("blob" as const) : ("direct" as const),
      directUrl: `/api/library/upload?docId=${plan.docId}&name=${encodeURIComponent(file.name)}`,
    };
  });
}

export async function registerLibraryDocAction(input: { docId: string; name: string; kind?: string }): Promise<ActionResult<{ id: string }>> {
  return runAction("library.register", async () => {
    const ctx = await requireOrg({ write: true });
    const doc = await registerLibraryDoc(ctx, input);
    await nudgeWorker();
    revalidatePath("/app/library");
    return { id: doc.id };
  });
}

export async function updateLibraryDocAction(docId: string, input: unknown): Promise<ActionResult> {
  return runAction("library.update", async () => {
    const ctx = await requireOrg({ write: true });
    await updateLibraryDoc(ctx, docId, input);
    revalidatePath("/app/library");
    return undefined;
  });
}

export async function deleteLibraryDocAction(docId: string): Promise<ActionResult> {
  return runAction("library.delete", async () => {
    const ctx = await requireOrg();
    await deleteLibraryDoc(ctx, docId);
    revalidatePath("/app/library");
    return undefined;
  });
}
