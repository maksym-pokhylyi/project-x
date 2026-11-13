import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bidRequirements, bids, companyFacts } from "@/db/schema";
import type { BidVerdict, CompanyFacts, CompanyStatus, RequirementCategory, RequirementKind } from "@/features/bids/types";
import { addUsage, callJson, ZERO_USAGE, type AiUsage } from "../ai/call";
import { resolveCompanyStatuses, type CheckRequirement, type ModelProposal } from "./company-check";
import { computeVerdict } from "./verdict";
import { COMPANY_CHECK_SYSTEM, COMPANY_CHECK_TASK } from "./prompts";
import { companyCheckOutputSchema } from "./schema";

const BATCH = 50;

/** True when the facts object holds anything worth comparing against. */
export function hasAnyFacts(facts: CompanyFacts | null | undefined): boolean {
  if (!facts) return false;
  return Object.values(facts).some((value) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.values(value).some((inner) => inner !== null && inner !== undefined);
    return true;
  });
}

export type CompanyCheckOutcome = { verdict: BidVerdict; usage: AiUsage; model: string | null };

/**
 * Step — "Checking against your company". Compares every requirement with the confirmed
 * company facts and writes met / gap / unknown / verify plus a cautious verdict. Without
 * confirmed facts no model call is made: everything stays "unknown" and the verdict says
 * so. Statuses a person set by hand are never overwritten.
 *
 * `organizationId` scopes every read and write: callers pass the bid's own organization
 * (jobs) or the session's organization (server actions).
 */
export async function runCompanyCheck(organizationId: string, bidId: string, userId: string | null): Promise<CompanyCheckOutcome> {
  const [bid] = await db.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.organizationId, organizationId)));
  if (!bid) throw new Error("Bid not found for company check");
  const rows = await db
    .select()
    .from(bidRequirements)
    .where(and(eq(bidRequirements.bidId, bidId), eq(bidRequirements.organizationId, organizationId)))
    .orderBy(asc(bidRequirements.sortOrder));
  const [factsRow] = await db.select().from(companyFacts).where(eq(companyFacts.organizationId, organizationId));
  const facts: CompanyFacts = factsRow?.facts ?? {};
  const factsConfirmed = Boolean(factsRow?.confirmedAt) && hasAnyFacts(facts);

  const requirements: CheckRequirement[] = rows.map((row) => ({
    id: row.id,
    category: row.category as RequirementCategory,
    text: row.text,
    threshold: row.threshold,
    kind: row.kind as RequirementKind,
    isPassFail: row.isPassFail,
    evidenceToProvide: row.evidenceToProvide,
    citation: row.citation,
    statusSetByUser: row.companyStatusSource === "user",
    currentStatus: row.companyStatus as CompanyStatus,
    currentNote: row.companyNote,
  }));

  const proposals = new Map<string, ModelProposal>();
  let usage = ZERO_USAGE;
  let model: string | null = null;
  // Only requirements whose quote was verified and that a person has not decided go to the model.
  const askable = requirements.filter((item) => !item.statusSetByUser && item.citation?.verified);
  if (factsConfirmed && askable.length > 0) {
    for (let offset = 0; offset < askable.length; offset += BATCH) {
      const batch = askable.slice(offset, offset + BATCH);
      const result = await callJson({
        organizationId,
        userId,
        feature: "bids.company_check",
        step: "company",
        system: COMPANY_CHECK_SYSTEM,
        messages: [
          `COMPANY FACTS (confirmed by the company; today is ${new Date().toISOString().slice(0, 10)}${bid.submissionDeadline ? `; submission deadline ${bid.submissionDeadline.toISOString().slice(0, 10)}` : ""}):`,
          JSON.stringify(facts, null, 1),
          "",
          "REQUIREMENTS:",
          JSON.stringify(
            batch.map((item) => ({ id: item.id, category: item.category, requirement: item.text, threshold: item.threshold, pass_fail: item.isPassFail, quote: item.citation?.quote ?? null })),
            null,
            1,
          ),
          "",
          COMPANY_CHECK_TASK,
        ].join("\n"),
        schema: companyCheckOutputSchema,
        maxOutputTokens: Math.min(16_000, 2_000 + batch.length * 160),
        timeoutMs: 120_000,
      });
      usage = addUsage(usage, result.usage);
      model = result.model;
      const known = new Set(batch.map((item) => item.id));
      for (const item of result.value.results) {
        if (known.has(item.id)) proposals.set(item.id, { status: item.status, reason: item.reason });
      }
    }
  }

  const results = resolveCompanyStatuses({ requirements, facts, factsConfirmed, proposals, submissionDeadline: bid.submissionDeadline });
  const byId = new Map(results.map((result) => [result.id, result]));
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const result = byId.get(row.id);
      if (!result || row.companyStatusSource === "user") continue;
      if (result.status === row.companyStatus && (result.note ?? null) === (row.companyNote ?? null)) continue;
      await tx.update(bidRequirements).set({ companyStatus: result.status, companyNote: result.note, updatedAt: new Date() }).where(eq(bidRequirements.id, row.id));
    }
    const verdict = computeVerdict(
      rows.map((row) => ({
        text: row.text,
        isPassFail: row.isPassFail,
        kind: row.kind as RequirementKind,
        category: row.category as RequirementCategory,
        status: byId.get(row.id)?.status ?? (row.companyStatus as CompanyStatus),
      })),
      factsConfirmed,
    );
    await tx.update(bids).set({ verdict, updatedAt: new Date() }).where(eq(bids.id, bidId));
  });
  const [updated] = await db.select({ verdict: bids.verdict }).from(bids).where(eq(bids.id, bidId));
  return { verdict: updated!.verdict!, usage, model };
}
