import { CheckCircle2, Circle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { OnboardingProgress } from "@/server/onboarding";

/** Config-driven checklist (src/config/onboarding.ts). Hidden once everything is done. */
export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  if (progress.total === 0 || progress.completed === progress.total) return null;
  const percent = Math.round((progress.completed / progress.total) * 100);
  return (
    <Card data-testid="onboarding-checklist">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>
          {progress.completed} of {progress.total} steps completed
        </CardDescription>
        <Progress value={percent} aria-label={`Onboarding ${percent}% complete`} className="mt-3" />
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-line">
          {progress.steps.map((step) => (
            <li key={step.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" data-done={step.done}>
              <div className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-brand" />
                ) : (
                  <Circle aria-label="To do" className="mt-0.5 size-5 shrink-0 text-ink-2" />
                )}
                <div>
                  <p className={step.done ? "text-sm font-medium text-ink-2 line-through" : "text-sm font-medium text-ink"}>{step.title}</p>
                  <p className="text-sm text-ink-2">{step.description}</p>
                </div>
              </div>
              {step.done ? null : (
                <ButtonLink href={step.href} variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
                  {step.cta}
                </ButtonLink>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
