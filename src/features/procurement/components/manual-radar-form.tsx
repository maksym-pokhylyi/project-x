"use client";

import { useActionState } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setUpRadarAction, type ProfileFormState } from "../actions";
import { UK_REGIONS } from "../domain/regions";
import { BROAD_TRADES } from "../domain/trades";
import type { RadarSelection } from "../radar/selection";
import { ChoiceGroup, TickRow } from "./ui/choice";
import { controlSize } from "./ui/control-size";

/**
 * "Set up a radar manually", as the FindNoResult artboards draw it: for a company no notice
 * names yet. A company name, the short list of trades, the twelve UK regions.
 *
 *   signed in     one button creates the radar (the Server Action behind it; a GET never does)
 *   signed out    the form asks for a work e-mail as well; the button stores NOTHING — it
 *                 carries the ticks through sign-up to the set-up page, which opens with
 *                 them filled in and asks for one confirmation
 *
 * `selection` pre-fills the form: what was typed into the search, or what came back from
 * sign-up in the address.
 */
const INITIAL: ProfileFormState = { error: null };

export function ManualRadarForm({
  selection,
  signedIn,
  submitLabel = "Set up my radar",
  note = "Free: your top 10 matches and a weekly digest.",
  headingId,
}: {
  selection: RadarSelection;
  signedIn: boolean;
  submitLabel?: string;
  note?: string;
  /** Id of the heading that names the form (the card's own heading). */
  headingId?: string;
}) {
  const [state, formAction, pending] = useActionState(setUpRadarAction, INITIAL);
  const fieldErrors = (state.error?.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {};
  const height = controlSize.form;
  // A submit that came back with an error shows what was ticked, not the form's first state.
  const current = state.selection ?? selection;

  return (
    <form key={state.attempt ?? 0} action={formAction} aria-labelledby={headingId} className="flex flex-col gap-6" data-testid="manual-radar-form" noValidate>
      {state.error && Object.keys(fieldErrors).length === 0 ? <FormError message={state.error.message} /> : null}
      <div className="max-w-[26.25rem]">
        <FormField label="Company name" name="name" defaultValue={current.name} autoComplete="organization" maxLength={80} required error={fieldErrors.name?.[0]} className={height} />
      </div>
      {/* Trades picked by their official name on an earlier screen travel with the form. */}
      {current.cpv.map((code) => (
        <input key={code} type="hidden" name="cpv" value={code} />
      ))}
      <ChoiceGroup legend="Trades" hint="tick all that apply" columns="wide" error={fieldErrors.cpvCodes?.[0]} className="max-w-[60rem]">
        {BROAD_TRADES.map((trade) => (
          <TickRow key={trade.key} name="trade" value={trade.key} defaultChecked={current.trades.includes(trade.key)}>
            {trade.label}
          </TickRow>
        ))}
      </ChoiceGroup>
      <ChoiceGroup legend="Regions" hint="tick all that apply" columns="wideFromTwo" className="max-w-[60rem]">
        {Object.entries(UK_REGIONS).map(([code, label]) => (
          <TickRow key={code} name="region" value={code} defaultChecked={current.regions.includes(code)}>
            {label}
          </TickRow>
        ))}
      </ChoiceGroup>
      {signedIn ? null : (
        <div className="max-w-[26.25rem]">
          <FormField label="Work email" name="email" type="email" inputMode="email" autoComplete="email" hint="We send a confirmation link to this address. Your radar opens once you confirm it." className={height} />
        </div>
      )}
      <div className="flex flex-col gap-x-5 gap-y-2 md:flex-row md:flex-wrap md:items-center">
        <Button type="submit" loading={pending} className={cn(height, "px-[1.375rem] text-base")} data-testid="manual-radar-submit">
          {submitLabel}
        </Button>
        <p className="text-sm text-ink-2">{note}</p>
      </div>
    </form>
  );
}
