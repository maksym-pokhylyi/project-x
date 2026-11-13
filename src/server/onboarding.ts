import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/config/onboarding";
import { db } from "@/db";
import { events } from "@/db/schema";
import type { OrgContext } from "./session";

export type OnboardingProgress = {
  steps: Array<OnboardingStep & { done: boolean }>;
  completed: number;
  total: number;
};

/** Which onboarding steps the active workspace has completed, derived from analytics events. */
export async function getOnboardingProgress(ctx: OrgContext): Promise<OnboardingProgress> {
  const names = [...new Set(ONBOARDING_STEPS.flatMap((step) => step.completedBy))];
  const rows =
    names.length === 0
      ? []
      : await db
          .selectDistinct({ name: events.name })
          .from(events)
          .where(and(eq(events.organizationId, ctx.organization.id), inArray(events.name, names)));
  const seen = new Set(rows.map((row) => row.name));
  const steps = ONBOARDING_STEPS.map((step) => ({ ...step, done: step.completedBy.some((name) => seen.has(name)) }));
  return { steps, completed: steps.filter((step) => step.done).length, total: steps.length };
}
