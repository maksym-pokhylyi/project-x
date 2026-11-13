import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
        <Progress value={percent} aria-label={`Onboarding ${percent}% complete`} className="mt-2" />
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {progress.steps.map((step) => (
            <li key={step.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" data-done={step.done}>
              <div className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 aria-label="Done" className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <Circle aria-label="To do" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className={step.done ? "text-sm font-medium text-muted-foreground line-through" : "text-sm font-medium"}>{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {step.done ? null : (
                <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
                  <Link href={step.href}>{step.cta}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
