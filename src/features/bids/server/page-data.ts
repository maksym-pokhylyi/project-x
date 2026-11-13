import "server-only";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { companyFacts } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { requireOrgForPage } from "@/server/session";
import { getBidWorkspace } from "./bids";

/**
 * Loads a bid for a workspace page: signs the user in if needed, resolves the workspace
 * from the session and returns 404 for anything outside it. Cached per request, so the
 * layout and the page share one load.
 */
export const loadBidPage = cache(async (bidId: string) => {
  const ctx = await requireOrgForPage({ returnTo: "/app/bids" });
  try {
    const workspace = await getBidWorkspace(ctx, bidId);
    if (workspace.bid.status === "draft") redirect(`/app/bids/new?bid=${workspace.bid.id}`);
    return { ctx, ...workspace };
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
});

/** Whether the workspace has confirmed company facts (drives the "confirm your facts" prompts). */
export async function factsConfirmed(organizationId: string): Promise<boolean> {
  const [row] = await db.select({ confirmedAt: companyFacts.confirmedAt }).from(companyFacts).where(eq(companyFacts.organizationId, organizationId));
  return Boolean(row?.confirmedAt);
}
