"use client";

import "@/features/bids/components/bid-theme.css";
import { Check, CircleAlert, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { TURNOVER_BAND_LABELS, TURNOVER_BANDS, type CompanyFacts } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { discardFactsDraftAction, draftFactsFromWebsiteAction, saveCompanyFactsAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/ui/textarea";

type AccreditationRow = { name: string; reference: string; expiresAt: string };

type FormState = {
  legalName: string;
  tradingName: string;
  companyNumber: string;
  website: string;
  turnoverBand: string;
  turnoverLatest: string;
  turnoverPrevious: string;
  turnoverYearEnd: string;
  employees: string;
  yearsTrading: string;
  publicLiability: string;
  publicLiabilityExpires: string;
  employersLiability: string;
  employersLiabilityExpires: string;
  professionalIndemnity: string;
  professionalIndemnityExpires: string;
  accreditations: AccreditationRow[];
  sectors: string;
  regions: string;
  policies: string;
  notes: string;
};

const money = (value: number | null | undefined) => (value === null || value === undefined ? "" : `£${value.toLocaleString("en-GB")}`);

function toForm(facts: CompanyFacts): FormState {
  return {
    legalName: facts.legalName ?? "",
    tradingName: facts.tradingName ?? "",
    companyNumber: facts.companyNumber ?? "",
    website: facts.website ?? "",
    turnoverBand: facts.turnoverBand ?? "",
    turnoverLatest: money(facts.turnover?.latestGbp),
    turnoverPrevious: money(facts.turnover?.previousGbp),
    turnoverYearEnd: facts.turnover?.yearEnd ?? "",
    employees: facts.employees?.toString() ?? "",
    yearsTrading: facts.yearsTrading?.toString() ?? "",
    publicLiability: money(facts.insurance?.publicLiability?.amountGbp),
    publicLiabilityExpires: facts.insurance?.publicLiability?.expiresAt ?? "",
    employersLiability: money(facts.insurance?.employersLiability?.amountGbp),
    employersLiabilityExpires: facts.insurance?.employersLiability?.expiresAt ?? "",
    professionalIndemnity: money(facts.insurance?.professionalIndemnity?.amountGbp),
    professionalIndemnityExpires: facts.insurance?.professionalIndemnity?.expiresAt ?? "",
    accreditations: (facts.accreditations ?? []).map((item) => ({ name: item.name, reference: item.reference ?? "", expiresAt: item.expiresAt ?? "" })),
    sectors: (facts.sectors ?? []).join(", "),
    regions: (facts.regions ?? []).join(", "),
    policies: (facts.policies ?? []).join("\n"),
    notes: facts.notes ?? "",
  };
}

function toInput(form: FormState) {
  return {
    legalName: form.legalName,
    tradingName: form.tradingName,
    companyNumber: form.companyNumber,
    website: form.website,
    turnoverBand: form.turnoverBand,
    turnover: { latestGbp: form.turnoverLatest, previousGbp: form.turnoverPrevious, yearEnd: form.turnoverYearEnd },
    employees: form.employees,
    yearsTrading: form.yearsTrading,
    insurance: {
      publicLiability: { amountGbp: form.publicLiability, expiresAt: form.publicLiabilityExpires },
      employersLiability: { amountGbp: form.employersLiability, expiresAt: form.employersLiabilityExpires },
      professionalIndemnity: { amountGbp: form.professionalIndemnity, expiresAt: form.professionalIndemnityExpires },
    },
    accreditations: form.accreditations.filter((item) => item.name.trim()).map((item) => ({ name: item.name, reference: item.reference, expiresAt: item.expiresAt })),
    sectors: form.sectors,
    regions: form.regions,
    policies: form.policies,
    notes: form.notes,
  };
}

/** A draft value fills a field only where the confirmed facts have nothing. */
function mergeDraft(facts: CompanyFacts, draft: CompanyFacts | null): { merged: CompanyFacts; suggested: Set<string> } {
  if (!draft) return { merged: facts, suggested: new Set() };
  const suggested = new Set<string>();
  const merged: CompanyFacts = structuredClone(facts);
  const scalar = ["legalName", "tradingName", "companyNumber", "website", "turnoverBand", "employees", "yearsTrading", "notes"] as const;
  for (const key of scalar) {
    if ((merged[key] === null || merged[key] === undefined || merged[key] === "") && draft[key] !== null && draft[key] !== undefined && draft[key] !== "") {
      (merged as Record<string, unknown>)[key] = draft[key];
      suggested.add(key);
    }
  }
  for (const key of ["publicLiability", "employersLiability", "professionalIndemnity"] as const) {
    const current = merged.insurance?.[key];
    const proposed = draft.insurance?.[key];
    if ((!current || current.amountGbp === null) && proposed?.amountGbp) {
      merged.insurance = { ...merged.insurance, [key]: proposed };
      suggested.add(key);
    }
  }
  for (const key of ["sectors", "regions", "policies"] as const) {
    if ((merged[key]?.length ?? 0) === 0 && (draft[key]?.length ?? 0) > 0) {
      merged[key] = draft[key];
      suggested.add(key);
    }
  }
  if ((merged.accreditations?.length ?? 0) === 0 && (draft.accreditations?.length ?? 0) > 0) {
    merged.accreditations = draft.accreditations;
    suggested.add("accreditations");
  }
  return { merged, suggested };
}

const DAY = 86_400_000;

/** Valid / expires soon / expired / no date, from the expiry date alone. */
function expiryState(date: string, now: number): { kind: "valid" | "soon" | "expired" | "none"; label: string; days: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "none", label: "No date", days: 0 };
  const end = new Date(`${date}T23:59:59Z`).getTime();
  const days = Math.round((end - now) / DAY);
  if (end < now) return { kind: "expired", label: "Expired", days: Math.abs(days) };
  if (days <= 92) return { kind: "soon", label: days <= 31 ? `Expires in ${days} day${days === 1 ? "" : "s"}` : `Expires in ${Math.round(days / 30.4)} months`, days };
  return { kind: "valid", label: "Valid", days };
}

function Field({ id, label, hint, error, suggested, children, className }: { id: string; label: string; hint?: string; error?: string; suggested?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-15 font-medium">
        {label}
        {suggested ? <span className="bid-pill bid-pill-amber text-xs">Suggested — check</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-13 font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-13 text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Company facts (design handoff: Documents). What checks and drafts may rely on: turnover,
 * insurance levels, accreditations with their expiry, and where the company works. A
 * website draft only pre-fills empty fields as suggestions; nothing counts until a person
 * saves. No figure is shown with a source it does not have.
 */
export function CompanyFactsForm({
  facts,
  draft,
  draftSource,
  confirmedAt,
  now,
}: {
  facts: CompanyFacts;
  draft: CompanyFacts | null;
  draftSource: { url: string; pages: string[]; notes: string[] } | null;
  confirmedAt: string | null;
  /** Server time of the render (expiry states must not depend on the visitor's clock mid-render). */
  now: number;
}) {
  const router = useRouter();
  const { merged, suggested } = useMemo(() => mergeDraft(facts, draft), [facts, draft]);
  const [form, setForm] = useState<FormState>(() => toForm(merged));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [drafting, startDrafting] = useTransition();
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const setAccreditation = (index: number, change: Partial<AccreditationRow>) => set("accreditations", form.accreditations.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const hasSuggestions = suggested.size > 0;
  const err = (key: string) => errors[key]?.[0];

  const save = () =>
    startSaving(async () => {
      setMessage(null);
      setErrors({});
      const result = await saveCompanyFactsAction(toInput(form));
      if (!result.ok) {
        const fieldErrors = (result.error.details?.fieldErrors as Record<string, string[]> | undefined) ?? {};
        setErrors(fieldErrors);
        setMessage({ tone: "error", text: Object.keys(fieldErrors).length > 0 ? "Some fields need attention — they are marked." : result.error.message });
        return;
      }
      setDirty(false);
      setMessage({ tone: "ok", text: "Saved and confirmed. Open a bid and use “Re-check against company facts” to update its requirements." });
      router.refresh();
    });

  const draftFromWebsite = () =>
    startDrafting(async () => {
      setMessage(null);
      const result = await draftFactsFromWebsiteAction(form.website);
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error.message });
        return;
      }
      // Remount with the new draft merged in.
      window.location.reload();
    });

  const insurance = [
    ["employersLiability", "Employer’s Liability"],
    ["publicLiability", "Public Liability"],
    ["professionalIndemnity", "Professional Indemnity"],
  ] as const;

  return (
    <form
      className="flex flex-col gap-6"
      data-testid="facts-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {hasSuggestions && draftSource ? (
        <div className="rounded-card bg-accent-tint px-5 py-4 text-sm" data-testid="facts-draft-banner">
          <p className="font-semibold">Filled in from {new URL(draftSource.url).hostname} — nothing is saved until you save</p>
          <p className="mt-1">Fields marked “Suggested” were read from your website by AI. Websites go out of date and AI misreads: check each one, correct what is wrong, then save.</p>
          {draftSource.notes.length > 0 ? (
            <details className="mt-2">
              <summary className="bid-link inline-flex min-h-9 cursor-pointer items-center font-medium">Where each suggestion came from</summary>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-13">
                {draftSource.notes.slice(0, 20).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <Button variant="outline" size="sm"
            type="button"
            className="mt-3"
            onClick={() =>
              startSaving(async () => {
                await discardFactsDraftAction();
                window.location.reload();
              })
            }
>
            Discard suggestions
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6">
          <fieldset className="bid-card flex flex-col gap-4 px-5 py-5 sm:px-6">
            <legend className="sr-only">Turnover</legend>
            <h3 className="bid-h3" aria-hidden>
              Turnover
            </h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
              <Field id="turnoverLatest" label="Latest year" error={err("turnover.latestGbp")}>
                <Input id="turnoverLatest" className="tabular-nums" inputMode="decimal" placeholder="£" value={form.turnoverLatest} onChange={(event) => set("turnoverLatest", event.target.value)}/>
              </Field>
              <Field id="turnoverPrevious" label="Year before" error={err("turnover.previousGbp")}>
                <Input id="turnoverPrevious" className="tabular-nums" inputMode="decimal" placeholder="£" value={form.turnoverPrevious} onChange={(event) => set("turnoverPrevious", event.target.value)}/>
              </Field>
              <Field id="turnoverYearEnd" label="Latest year ended" error={err("turnover.yearEnd")}>
                <Input id="turnoverYearEnd"  type="date" value={form.turnoverYearEnd} onChange={(event) => set("turnoverYearEnd", event.target.value)}/>
              </Field>
            </div>
            {form.turnoverLatest.trim() ? (
              <p className="text-13 text-ink-2">From your filed accounts. You can type 3.9m or 3,900,000.</p>
            ) : (
              <Field id="turnoverBand" label="Or choose a range" error={err("turnoverBand")} suggested={suggested.has("turnoverBand")} hint="An exact figure settles more turnover tests than a range.">
                <NativeSelect id="turnoverBand"  value={form.turnoverBand} onChange={(event) => set("turnoverBand", event.target.value)}>
                  <option value="">Not given</option>
                  {TURNOVER_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {TURNOVER_BAND_LABELS[band]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </fieldset>

          <fieldset className="bid-card flex flex-col gap-4 px-5 py-5 sm:px-6">
            <legend className="sr-only">Insurance levels</legend>
            <h3 className="bid-h3" aria-hidden>
              Insurance levels
            </h3>
            {insurance.map(([key, label]) => {
              const state = expiryState(form[`${key}Expires`], now);
              return (
                <div key={key} className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-4">
                  <Field id={key} label={label} error={err(`insurance.${key}.amountGbp`)} suggested={suggested.has(key)}>
                    <Input id={key} className="tabular-nums" inputMode="decimal" placeholder="£" value={form[key]} onChange={(event) => set(key, event.target.value)}/>
                  </Field>
                  <Field
                    id={`${key}Expires`}
                    label="Cover runs to"
                    error={err(`insurance.${key}.expiresAt`)}
                    hint={state.kind === "expired" ? undefined : state.kind === "soon" ? state.label : undefined}
                  >
                    <Input id={`${key}Expires`}  type="date" value={form[`${key}Expires`]} onChange={(event) => set(`${key}Expires`, event.target.value)}/>
                    {state.kind === "expired" && form[key].trim() ? <p className="text-13 font-semibold text-danger">Ended {state.days} days ago. Checks ask you to confirm it was renewed.</p> : null}
                  </Field>
                </div>
              );
            })}
            <p className="text-13 text-ink-2">Leave blank what you do not hold. Levels are compared with each tender by arithmetic, not by AI.</p>
          </fieldset>
        </div>

        <fieldset className="bid-card min-w-0 flex-[1.4_1_460px] pb-5">
          <legend className="sr-only">Accreditations</legend>
          <h3 className="bid-h3 flex flex-wrap items-center gap-2 px-5 pt-5 sm:px-6" aria-hidden>
            Accreditations
            {suggested.has("accreditations") ? <span className="bid-pill bid-pill-amber text-xs">Suggested — check</span> : null}
          </h3>
          <div className="mt-4 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 border-b border-line px-5 pb-2.5 text-xs font-semibold text-ink-2 sm:grid sm:px-6">
            <span>Accreditation</span>
            <span>Expires</span>
            <span>Status</span>
            <span />
          </div>
          {form.accreditations.length === 0 ? (
            <p className="border-b border-line px-5 py-4 text-sm text-ink-2 sm:px-6">None recorded. A requirement is only shown as met when the named certificate is here and in date.</p>
          ) : null}
          {form.accreditations.map((row, index) => {
            const state = expiryState(row.expiresAt, now);
            return (
              <div key={index} className="border-b border-line px-5 py-3 sm:px-6" data-testid="accreditation-row" data-expiry={state.kind}>
                <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_44px]">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`accreditation-name-${index}`} className="sr-only">
                      Accreditation name
                    </label>
                    <Input
                      id={`accreditation-name-${index}`}
                      className="font-semibold"
                      value={row.name}
                      placeholder="e.g. ISO 9001, CHAS, Cyber Essentials"
                      maxLength={120}
                      onChange={(event) => setAccreditation(index, { name: event.target.value })}
/>
                    {err(`accreditations.${index}.name`) ? <p className="text-13 text-danger">{err(`accreditations.${index}.name`)}</p> : null}
                  </div>
                  <div>
                    <label htmlFor={`accreditation-expiry-${index}`} className="sr-only">
                      Expires
                    </label>
                    <Input id={`accreditation-expiry-${index}`}  type="date" value={row.expiresAt} onChange={(event) => setAccreditation(index, { expiresAt: event.target.value })}/>
                  </div>
                  <span className="text-13 font-semibold">
                    {state.kind === "valid" ? (
                      <span className="inline-flex items-center gap-1.5 text-brand">
                        <Check aria-hidden className="size-3.5" strokeWidth={2.6} />
                        Valid
                      </span>
                    ) : state.kind === "soon" ? (
                      <span className="inline-flex items-center gap-2 text-accent-ink">
                        <span aria-hidden className="size-2 rounded-full bg-paper-deep" />
                        {state.label}
                      </span>
                    ) : state.kind === "expired" ? (
                      <span className="bid-pill bid-pill-danger">
                        <span aria-hidden>!</span>Expired
                      </span>
                    ) : (
                      <span className="font-normal text-ink-2">No date</span>
                    )}
                  </span>
                  <Button variant="ghost" size="icon" type="button" className="shrink-0" aria-label={`Remove ${row.name || "accreditation"}`} onClick={() => set("accreditations", form.accreditations.filter((_, i) => i !== index))}>
                    <X aria-hidden className="size-4" />
                  </Button>
                </div>
                {state.kind === "expired" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-danger-tint px-4 py-3 text-sm">
                    <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" strokeWidth={1.8} />
                    <p className="min-w-0 flex-[1_1_220px]">
                      <span className="font-semibold text-danger">Expired {state.days} days ago.</span> Checks treat it as not held until you enter the renewed date.
                    </p>
                    <ButtonLink variant="outline" size="sm" href="#documents">
                      Upload renewal
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="px-5 pt-5 sm:px-6">
            <Button variant="outline" type="button"  onClick={() => set("accreditations", [...form.accreditations, { name: "", reference: "", expiresAt: "" }])}>
              <Plus aria-hidden className="size-4" />
              Add accreditation
            </Button>
          </div>
        </fieldset>
      </div>

      <details className="bid-card px-5 py-4 sm:px-6" open={!confirmedAt || hasSuggestions || undefined}>
        <summary className="bid-h3 cursor-pointer">Company details and where you work</summary>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
          <Field id="legalName" label="Legal name" error={err("legalName")} suggested={suggested.has("legalName")}>
            <Input id="legalName"  value={form.legalName} onChange={(event) => set("legalName", event.target.value)} maxLength={160}/>
          </Field>
          <Field id="tradingName" label="Trading name (if different)" error={err("tradingName")} suggested={suggested.has("tradingName")}>
            <Input id="tradingName"  value={form.tradingName} onChange={(event) => set("tradingName", event.target.value)} maxLength={160}/>
          </Field>
          <Field id="companyNumber" label="Companies House number" error={err("companyNumber")} suggested={suggested.has("companyNumber")} hint="8 characters, for example 01234567">
            <Input id="companyNumber" className="bid-mono" value={form.companyNumber} onChange={(event) => set("companyNumber", event.target.value)} maxLength={10}/>
          </Field>
          <Field id="website" label="Website" error={err("website")} hint="We can read it to suggest facts for the empty fields. You check and save them.">
            <div className="flex flex-wrap gap-2">
              <Input id="website" className="min-w-0 flex-[1_1_180px]" value={form.website} onChange={(event) => set("website", event.target.value)} placeholder="https://www.yourcompany.co.uk" maxLength={200}/>
              <Button variant="outline" type="button"  disabled={drafting || !form.website.trim()} onClick={draftFromWebsite} data-testid="draft-from-website">
                {drafting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                {drafting ? "Reading…" : "Suggest from website"}
              </Button>
            </div>
          </Field>
          <Field id="employees" label="Employees" error={err("employees")} suggested={suggested.has("employees")}>
            <Input id="employees"  inputMode="numeric" value={form.employees} onChange={(event) => set("employees", event.target.value)}/>
          </Field>
          <Field id="yearsTrading" label="Years trading" error={err("yearsTrading")} suggested={suggested.has("yearsTrading")}>
            <Input id="yearsTrading"  inputMode="numeric" value={form.yearsTrading} onChange={(event) => set("yearsTrading", event.target.value)}/>
          </Field>
          <Field id="sectors" label="Sectors" hint="Comma-separated, for example Local government, Housing, Schools" suggested={suggested.has("sectors")}>
            <Textarea id="sectors"  rows={2} value={form.sectors} onChange={(event) => set("sectors", event.target.value)}/>
          </Field>
          <Field id="regions" label="Regions" hint="Comma-separated, for example North East England, Yorkshire" suggested={suggested.has("regions")}>
            <Textarea id="regions"  rows={2} value={form.regions} onChange={(event) => set("regions", event.target.value)}/>
          </Field>
          <Field id="policies" label="Policies you hold" hint="One per line, for example Health and Safety Policy" suggested={suggested.has("policies")}>
            <Textarea id="policies"  rows={4} value={form.policies} onChange={(event) => set("policies", event.target.value)}/>
          </Field>
          <Field id="notes" label="Anything else worth knowing" hint="Short facts you would repeat in most bids: depots, fleet, DBS-checked staff" suggested={suggested.has("notes")}>
            <Textarea id="notes"  rows={4} value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={4000}/>
          </Field>
        </div>
      </details>

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-card px-4 py-3 text-sm", message.tone === "error" ? "bg-danger-tint text-danger" : "bg-brand-tint")}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit"  disabled={saving} data-testid="confirm-facts">
          {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <p className="text-sm text-ink-2" data-testid="facts-status" data-confirmed={confirmedAt ? "true" : "false"}>
          {dirty || hasSuggestions
            ? "Unsaved changes. Saving confirms these facts are true today; checks and drafts will rely on them."
            : confirmedAt
              ? `Last saved ${new Date(confirmedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " at")}`
              : "Not saved yet: checks and drafts cannot use these facts until you save."}
        </p>
      </div>
    </form>
  );
}
