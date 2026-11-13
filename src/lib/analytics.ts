import "server-only";
import { PostHog } from "posthog-node";
import { db } from "@/db";
import { events } from "@/db/schema";
import type { EventMap, EventName } from "@/config/events";
import { env, features } from "@/env";
import { log } from "./logger";

export type TrackContext = {
  organizationId?: string | null;
  userId?: string | null;
};

let posthog: PostHog | null = null;

function getPosthog(): PostHog | null {
  if (!features.posthog || !env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  posthog ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Serverless: never buffer, each capture is sent (and awaited) immediately.
    flushAt: 1,
    flushInterval: 0,
  });
  return posthog;
}

/**
 * The single entry point for product analytics. Server-side only.
 *
 *   await track("member.invited", { organizationId, userId }, { role: "member" });
 *
 * Writes to the internal `events` table (the source of truth for /admin) and forwards
 * to PostHog when NEXT_PUBLIC_POSTHOG_KEY is set. Event names and property shapes are
 * checked against src/config/events.ts. Never throws: analytics must not break a flow.
 */
export async function track<Name extends EventName>(
  name: Name,
  context: TrackContext,
  ...[properties]: EventMap[Name] extends Record<string, never> ? [properties?: EventMap[Name]] : [properties: EventMap[Name]]
): Promise<void> {
  const props = (properties ?? {}) as Record<string, unknown>;
  try {
    await db.insert(events).values({
      organizationId: context.organizationId ?? null,
      userId: context.userId ?? null,
      name,
      properties: props,
    });
  } catch (error) {
    log.warn("analytics: failed to store event", { name, reason: error instanceof Error ? error.message : "unknown" });
  }

  const client = getPosthog();
  if (!client) return;
  try {
    await client.captureImmediate({
      // Server events without a user are attributed to the workspace.
      distinctId: context.userId ?? `org:${context.organizationId ?? "unknown"}`,
      event: name,
      properties: { ...props, organization_id: context.organizationId ?? undefined, $process_person_profile: false },
      groups: context.organizationId ? { organization: context.organizationId } : undefined,
    });
  } catch (error) {
    log.warn("analytics: posthog forwarding failed", { name, reason: error instanceof Error ? error.message : "unknown" });
  }
}
