"use client";

import { CircleCheck, Globe, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isPastDate } from "@/features/bids/locations";
import { TURNOVER_BAND_LABELS, TURNOVER_BANDS, type CompanyFacts } from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { discardFactsDraftAction, draftFactsFromWebsiteAction, saveCompanyFactsAction } from "../actions";
import { expiryWarnings } from "../facts-schema";

type AccreditationRow = { name: string; reference: string; expiresAt: string };

type FormState = {
  legalName: string;
  tradingName: string;
  companyNumber: string;
  website: string;
  turnoverBand: string;
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

function toForm(facts: CompanyFacts): FormState {
  const money = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    legalName: facts.legalName ?? "",
    tradingName: facts.tradingName ?? "",
    companyNumber: facts.companyNumber ?? "",
    website: facts.website ?? "",
    turnoverBand: facts.turnoverBand ?? "",
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

function Field({ id, label, hint, error, suggested, children }: { id: string; label: string; hint?: string; error?: string; suggested?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {suggested ? <span className="rounded border border-warning/40 bg-warning/10 px-1.5 text-[11px] font-medium text-warning">Suggested — check</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive">
          <TriangleAlert aria-hidden className="size-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Company facts: what drafts and requirement checks are allowed to rely on. A website
 * draft only ever pre-fills empty fields as suggestions; nothing counts until a person
 * presses "Confirm company facts".
 */
export function CompanyFactsForm({
  facts,
  draft,
  draftSource,
  confirmedAt,
}: {
  facts: CompanyFacts;
  draft: CompanyFacts | null;
  draftSource: { url: string; pages: string[]; notes: string[] } | null;
  confirmedAt: string | null;
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
  const warnings = expiryWarnings(facts);
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
        setMessage({ tone: "error", text: Object.keys(fieldErrors).length > 0 ? "Some fields need attention — they are marked below." : result.error.message });
        return;
      }
      setDirty(false);
      setMessage({ tone: "ok", text: "Company facts confirmed. Open a bid and use “Re-check against company facts” to update its requirements." });
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
      setMessage({ tone: "ok", text: `Read ${result.data.pages} page${result.data.pages === 1 ? "" : "s"} of your website. Suggestions fill the empty fields below — check each one, then confirm.` });
      // Remount with the new draft merged in.
      window.location.reload();
    });

  return (
    <form
      className="space-y-6"
      data-testid="facts-form"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="facts-status" data-confirmed={confirmedAt ? "true" : "false"}>
        {confirmedAt && !hasSuggestions ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <CircleCheck aria-hidden className="size-4" />
            Confirmed {new Date(confirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium text-warning">
            <TriangleAlert aria-hidden className="size-4" />
            {hasSuggestions ? "Suggestions waiting for your confirmation" : "Not confirmed yet — drafts and requirement checks cannot use these facts"}
          </span>
        )}
      </div>

      {warnings.length > 0 ? (
        <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm" data-testid="expiry-warnings">
          <p className="font-semibold">Check these dates</p>
          <ul className="mt-1 space-y-0.5">
            {warnings.map((warning) => (
              <li key={`${warning.label}-${warning.date}`}>
                <span className={warning.state === "expired" ? "font-medium text-destructive" : ""}>
                  {warning.label} {warning.state === "expired" ? "expired on" : "expires on"} {new Date(`${warning.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                </span>
                {warning.state === "expired" ? " — requirements that need it are shown as a gap." : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasSuggestions && draftSource ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm" data-testid="facts-draft-banner">
          <p className="font-semibold">Auto-filled from {new URL(draftSource.url).hostname} — nothing is saved until you confirm</p>
          <p className="mt-1 text-muted-foreground">
            Fields marked “Suggested” were read from your website by AI. Websites go out of date and AI misreads: check every suggested value, correct what is wrong, then confirm.
          </p>
          {draftSource.notes.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-muted-foreground">Where each suggestion came from</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {draftSource.notes.slice(0, 20).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
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

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Company</legend>
        <Field id="legalName" label="Legal name" error={err("legalName")} suggested={suggested.has("legalName")}>
          <Input id="legalName" value={form.legalName} onChange={(event) => set("legalName", event.target.value)} maxLength={160} />
        </Field>
        <Field id="tradingName" label="Trading name (if different)" error={err("tradingName")} suggested={suggested.has("tradingName")}>
          <Input id="tradingName" value={form.tradingName} onChange={(event) => set("tradingName", event.target.value)} maxLength={160} />
        </Field>
        <Field id="companyNumber" label="Companies House number" error={err("companyNumber")} suggested={suggested.has("companyNumber")} hint="8 characters, e.g. 01234567">
          <Input id="companyNumber" value={form.companyNumber} onChange={(event) => set("companyNumber", event.target.value)} maxLength={10} className="font-mono" />
        </Field>
        <Field id="website" label="Website" error={err("website")} hint="We can read it to suggest facts for the empty fields. You confirm them.">
          <div className="flex gap-2">
            <Input id="website" value={form.website} onChange={(event) => set("website", event.target.value)} placeholder="https://www.yourcompany.co.uk" maxLength={200} />
            <Button type="button" variant="outline" disabled={drafting || !form.website.trim()} onClick={draftFromWebsite} data-testid="draft-from-website">
              {drafting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Globe aria-hidden className="size-4" />}
              {drafting ? "Reading…" : "Suggest from website"}
            </Button>
          </div>
        </Field>
        <Field id="turnoverBand" label="Annual turnover" error={err("turnoverBand")} suggested={suggested.has("turnoverBand")} hint="From your latest accounts. Used for financial standing tests.">
          <NativeSelect id="turnoverBand" className="w-full" value={form.turnoverBand} onChange={(event) => set("turnoverBand", event.target.value)}>
            <option value="">Not given</option>
            {TURNOVER_BANDS.map((band) => (
              <option key={band} value={band}>
                {TURNOVER_BAND_LABELS[band]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="employees" label="Employees" error={err("employees")} suggested={suggested.has("employees")}>
            <Input id="employees" inputMode="numeric" value={form.employees} onChange={(event) => set("employees", event.target.value)} />
          </Field>
          <Field id="yearsTrading" label="Years trading" error={err("yearsTrading")} suggested={suggested.has("yearsTrading")}>
            <Input id="yearsTrading" inputMode="numeric" value={form.yearsTrading} onChange={(event) => set("yearsTrading", event.target.value)} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Insurance</legend>
        <p className="mb-3 text-xs text-muted-foreground">Level of cover in pounds (you can type 5m or 5,000,000) and the renewal date. Leave blank what you do not hold.</p>
        <div className="space-y-3">
          {(
            [
              ["publicLiability", "Public liability"],
              ["employersLiability", "Employers' liability"],
              ["professionalIndemnity", "Professional indemnity"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid gap-3 sm:grid-cols-[1fr_11rem_11rem] sm:items-end">
              <p className="text-sm sm:pb-2">
                {label}
                {suggested.has(key) ? <span className="ml-2 rounded border border-warning/40 bg-warning/10 px-1.5 text-[11px] font-medium text-warning">Suggested — check</span> : null}
              </p>
              <Field id={key} label="Cover (£)" error={err(`insurance.${key}.amountGbp`)}>
                <Input id={key} inputMode="decimal" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder="5,000,000" className="tabular-nums" />
              </Field>
              <Field id={`${key}Expires`} label="Renews on" error={err(`insurance.${key}.expiresAt`)}>
                <Input id={`${key}Expires`} type="date" value={form[`${key}Expires`]} onChange={(event) => set(`${key}Expires`, event.target.value)} />
              </Field>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
          Accreditations and certifications
          {suggested.has("accreditations") ? <span className="rounded border border-warning/40 bg-warning/10 px-1.5 text-[11px] font-medium text-warning">Suggested — check</span> : null}
        </legend>
        <p className="mb-3 text-xs text-muted-foreground">ISO standards, Cyber Essentials, CHAS, Constructionline, trade registrations. A requirement is only shown as “Met” when the named certificate is here and in date.</p>
        <div className="space-y-2">
          {form.accreditations.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end" data-testid="accreditation-row">
              <Field id={`accreditation-name-${index}`} label={index === 0 ? "Name" : "Name"} error={err(`accreditations.${index}.name`)}>
                <Input id={`accreditation-name-${index}`} value={row.name} onChange={(event) => set("accreditations", form.accreditations.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))} placeholder="ISO 9001:2015" maxLength={120} />
              </Field>
              <Field id={`accreditation-ref-${index}`} label="Certificate no.">
                <Input id={`accreditation-ref-${index}`} value={row.reference} onChange={(event) => set("accreditations", form.accreditations.map((item, i) => (i === index ? { ...item, reference: event.target.value } : item)))} maxLength={80} />
              </Field>
              <Field id={`accreditation-expiry-${index}`} label="Expires" error={err(`accreditations.${index}.expiresAt`)}>
                <Input
                  id={`accreditation-expiry-${index}`}
                  type="date"
                  value={row.expiresAt}
                  onChange={(event) => set("accreditations", form.accreditations.map((item, i) => (i === index ? { ...item, expiresAt: event.target.value } : item)))}
                  className={cn(isPastDate(row.expiresAt) ? "border-destructive text-destructive" : "")}
                />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${row.name || "accreditation"}`} onClick={() => set("accreditations", form.accreditations.filter((_, i) => i !== index))}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("accreditations", [...form.accreditations, { name: "", reference: "", expiresAt: "" }])}>
            <Plus aria-hidden className="size-3.5" />
            Add accreditation
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Where you work</legend>
        <Field id="sectors" label="Sectors" hint="Comma-separated, e.g. Local government, Housing, Schools" suggested={suggested.has("sectors")}>
          <Textarea id="sectors" rows={2} value={form.sectors} onChange={(event) => set("sectors", event.target.value)} />
        </Field>
        <Field id="regions" label="Regions" hint="Comma-separated, e.g. North East England, Yorkshire" suggested={suggested.has("regions")}>
          <Textarea id="regions" rows={2} value={form.regions} onChange={(event) => set("regions", event.target.value)} />
        </Field>
        <Field id="policies" label="Policies you hold" hint="One per line, e.g. Health and Safety Policy" suggested={suggested.has("policies")}>
          <Textarea id="policies" rows={4} value={form.policies} onChange={(event) => set("policies", event.target.value)} />
        </Field>
        <Field id="notes" label="Anything else worth knowing" hint="Short facts you would repeat in most bids: depots, fleet, DBS-checked staff…" suggested={suggested.has("notes")}>
          <Textarea id="notes" rows={4} value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={4000} />
        </Field>
      </fieldset>

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", message.tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/10")}>
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={saving} data-testid="confirm-facts">
          {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Confirm company facts"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {dirty || hasSuggestions ? "Unconfirmed changes. " : ""}By confirming you tell us these facts are true today. Drafts and requirement checks will rely on them.
        </p>
      </div>
    </form>
  );
}
