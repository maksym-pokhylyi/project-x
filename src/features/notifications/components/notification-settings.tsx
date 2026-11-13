"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { resubscribeAction, updateNotificationPrefsAction, type NotificationPrefsState } from "../actions";
import type { PrefKey } from "../prefs";

export type NotificationSettingsRow = {
  key: PrefKey;
  label: string;
  description: string;
  /** Shown in place of the switch when the plan does not include this kind of email. */
  unavailable?: { text: string; link: { label: string; href: string } };
  /** Stays switchable after "unsubscribe from all" (the renewal reminder is a billing notice). */
  independent?: boolean;
};

/**
 * The switches of Settings → Notifications. Each one saves on its own, straight away
 * (a Server Action); the words "On" / "Off" next to it say what is stored.
 */
export function NotificationSettings({ rows, initial }: { rows: NotificationSettingsRow[]; initial: NotificationPrefsState }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<PrefKey | "all" | null>(null);

  async function toggle(row: NotificationSettingsRow, on: boolean) {
    if (saving) return;
    const previous = prefs;
    setPrefs({ ...prefs, [row.key]: on });
    setSaving(row.key);
    const result = await updateNotificationPrefsAction({ [row.key]: on });
    setSaving(null);
    if (!result.ok) {
      setPrefs(previous);
      toast.error(result.error.message);
      return;
    }
    setPrefs(result.data);
    toast.success(`${row.label} turned ${on ? "on" : "off"}.`);
  }

  async function turnBackOn() {
    setSaving("all");
    const result = await resubscribeAction();
    setSaving(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setPrefs(result.data);
    toast.success("Emails turned back on.");
  }

  return (
    <div className="flex flex-col gap-5">
      {prefs.unsubscribedAll ? (
        <Alert variant="warning" role="status" data-testid="notifications-all-off">
          <AlertTitle>Emails are off</AlertTitle>
          <AlertDescription>
            <p>You unsubscribed from all emails. Turn them back on and the switches below apply again.</p>
            <Button variant="outline" size="sm" className="mt-3" loading={saving === "all"} onClick={turnBackOn} data-testid="notifications-resubscribe">
              Turn emails back on
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col">
        {rows.map((row) => {
          const on = prefs[row.key];
          const stopped = prefs.unsubscribedAll && !row.independent;
          const id = `notify-${row.key}`;
          return (
            <li key={row.key} className="flex items-start justify-between gap-x-6 gap-y-2 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 max-sm:flex-col">
              <div className="min-w-0">
                <label htmlFor={row.unavailable ? undefined : id} className="text-15 font-semibold text-ink">
                  {row.label}
                </label>
                <p id={`${id}-about`} className="mt-0.5 max-w-[36rem] text-sm text-ink-2">
                  {row.description}
                </p>
              </div>
              {row.unavailable ? (
                <Unavailable>
                  {row.unavailable.text}{" "}
                  <Link href={row.unavailable.link.href} className="link whitespace-nowrap">
                    {row.unavailable.link.label}
                  </Link>
                </Unavailable>
              ) : (
                <div className="flex shrink-0 items-center gap-2.5 sm:pt-0.5">
                  <Switch
                    id={id}
                    checked={on}
                    disabled={stopped || saving !== null}
                    aria-describedby={`${id}-about`}
                    onCheckedChange={(value) => toggle(row, value)}
                    data-testid={`notify-switch-${row.key}`}
                  />
                  <span aria-hidden className="w-6 text-sm text-ink-2">
                    {on ? "On" : "Off"}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="shrink-0 text-sm text-ink-2 sm:max-w-[14rem] sm:pt-0.5 sm:text-right">{children}</p>;
}
