"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { FormError, FormField } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveRadarProfileAction, type ProfileFormState } from "../actions";

export type TradeOption = { code: string; label: string };

type Props = {
  profileId?: string;
  defaults: { name: string; trades: TradeOption[]; regions: string[]; keywords: string; valueMin: number | null; valueMax: number | null };
  /** Common trades offered before the user types anything. */
  suggestions: TradeOption[];
  regions: Array<{ code: string; label: string }>;
};

const VALUE_STEPS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000];
const money = (value: number) => (value >= 1_000_000 ? `£${value / 1_000_000}m` : `£${value / 1000}k`);

/**
 * Manual radar profile: trades (CPV picker with plain-English labels), regions, keywords
 * and contract size. For companies with no published awards yet.
 */
export function RadarProfileForm({ profileId, defaults, suggestions, regions }: Props) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveRadarProfileAction, { error: null });
  const [trades, setTrades] = useState<TradeOption[]>(defaults.trades);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<{ term: string; options: TradeOption[] }>({ term: "", options: [] });
  const searchId = useId();
  const latest = useRef(0);
  const fieldErrors = (state.error?.details?.fieldErrors as Record<string, string[]> | undefined) ?? {};
  const query = term.trim();

  useEffect(() => {
    if (query.length < 2 || query === found.term) return;
    const ticket = ++latest.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/procurement/cpv?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const body = (await response.json()) as { results: TradeOption[] };
        if (ticket === latest.current) setFound({ term: query, options: body.results });
      } catch {
        // Suggestions are optional; the list of common trades stays available.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, found.term]);

  const options = (query.length >= 2 && found.term === query ? found.options : suggestions).filter((option) => !trades.some((trade) => trade.code === option.code));
  const add = (option: TradeOption) => setTrades((current) => (current.some((trade) => trade.code === option.code) ? current : [...current, option]));
  const remove = (code: string) => setTrades((current) => current.filter((trade) => trade.code !== code));

  return (
    <form action={formAction} className="space-y-6" noValidate data-testid="radar-profile-form">
      {profileId ? <input type="hidden" name="profileId" value={profileId} /> : null}
      {state.error && Object.keys(fieldErrors).length === 0 ? <FormError message={state.error.message} /> : null}

      <FormField label="Name of this radar" name="name" defaultValue={defaults.name} required maxLength={80} hint="Usually your company name." error={fieldErrors.name?.[0]} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Your trades</legend>
        <p className="text-xs text-muted-foreground">Pick the kinds of work you do. Buyers label every tender with these categories.</p>
        {trades.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Selected trades" data-testid="selected-trades">
            {trades.map((trade) => (
              <li key={trade.code} className="inline-flex items-center gap-1 rounded-full border bg-secondary py-1 pl-3 pr-1 text-sm">
                <input type="hidden" name="cpv" value={trade.code} />
                {trade.label}
                <button type="button" onClick={() => remove(trade.code)} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-muted" aria-label={`Remove ${trade.label}`}>
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <Label htmlFor={searchId} className="sr-only">
            Search trades
          </Label>
          <Input id={searchId} type="search" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search trades, e.g. grounds maintenance, scaffolding, payroll" autoComplete="off" />
        </div>
        <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-1 sm:grid-cols-2" aria-label={query.length >= 2 ? "Matching trades" : "Common trades"} data-testid="trade-options">
          {options.slice(0, 40).map((option) => (
            <li key={option.code}>
              <button type="button" onClick={() => add(option)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                <span>{option.label}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{option.code}</span>
              </button>
            </li>
          ))}
          {options.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground">No trade matches “{query}”. Try a broader word, or add it as a keyword below.</li> : null}
        </ul>
        {fieldErrors.cpvCodes ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {fieldErrors.cpvCodes[0]}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Where you work</legend>
        <p className="text-xs text-muted-foreground">Leave all unticked if you work anywhere in the UK.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {regions.map((region) => (
            <label key={region.code} className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="region" value={region.code} defaultChecked={defaults.regions.includes(region.code)} className="size-4 rounded border-input" />
              {region.label}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        label="Keywords"
        name="keywords"
        defaultValue={defaults.keywords}
        hint="Words buyers use for your work, separated by commas: asbestos survey, minibus hire, CCTV."
        error={fieldErrors.keywords?.[0]}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Contract size you can take on</legend>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="profile-value-min">From</Label>
            <NativeSelect id="profile-value-min" name="valueMin" defaultValue={defaults.valueMin ? String(defaults.valueMin) : ""}>
              <option value="">No minimum</option>
              {VALUE_STEPS.map((step) => (
                <option key={step} value={step}>
                  {money(step)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-value-max">Up to</Label>
            <NativeSelect id="profile-value-max" name="valueMax" defaultValue={defaults.valueMax ? String(defaults.valueMax) : ""}>
              <option value="">No maximum</option>
              {VALUE_STEPS.map((step) => (
                <option key={step} value={step}>
                  {money(step)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {fieldErrors.valueMax ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {fieldErrors.valueMax[0]}
          </p>
        ) : null}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : profileId ? "Save changes" : "Save and open my radar"}
      </Button>
    </form>
  );
}
