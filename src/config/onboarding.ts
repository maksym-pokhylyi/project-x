import type { EventName } from "./events";

/**
 * Onboarding checklist shown on /app. Config-driven: each step is "done" once the
 * workspace has recorded `completedBy` at least once (see src/server/onboarding.ts).
 * Replace the steps with the first actions that make YOUR product valuable.
 */
export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  /** Any of these analytics events marks the step as complete. */
  completedBy: EventName[];
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "name-workspace",
    title: "Name your workspace",
    description: "Give your workspace a name your teammates will recognise.",
    href: "/app/settings/workspace",
    cta: "Open workspace settings",
    completedBy: ["workspace.updated"],
  },
  {
    id: "invite-team",
    title: "Invite a teammate",
    description: "Work is better together. Invite a colleague to collaborate.",
    href: "/app/settings/members",
    cta: "Invite members",
    completedBy: ["member.invited"],
  },
  {
    id: "choose-plan",
    title: "Pick a plan",
    description: "Start free and upgrade when you need more seats or volume.",
    href: "/app/settings/billing",
    cta: "View plans",
    completedBy: ["billing.checkout_started", "billing.subscription_started"],
  },
];
