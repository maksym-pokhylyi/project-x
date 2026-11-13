import { z } from "zod";
import { TURNOVER_BANDS, type CompanyFacts } from "@/features/bids/types";

/**
 * Validation of company facts — shared by the form (client), the save action (server) and
 * the website auto-draft (model output). Forgiving on input (blank strings become null,
 * numbers may arrive as text), strict on what is stored.
 */

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return String(value);
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, max);
  }, z.string().nullable());

const optionalNumber = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const cleaned = value.replace(/[£,\s]/g, "");
      if (cleaned === "") return null;
      const match = /^(\d+(?:\.\d+)?)(m|k)?$/i.exec(cleaned);
      if (!match) return Number.NaN;
      const multiplier = match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2]?.toLowerCase() === "k" ? 1_000 : 1;
      return Number(match[1]) * multiplier;
    }
    return Number.NaN;
  }, z.number({ error: "Enter a number." }).min(min, "Too small.").max(max, "Too large.").nullable());

const optionalDate = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed.slice(0, 10);
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-31.")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "That date does not exist.")
    .nullable(),
);

const coverSchema = z.preprocess(
  (value) => value ?? { amountGbp: null, expiresAt: null },
  z.object({ amountGbp: optionalNumber(0, 1_000_000_000), expiresAt: optionalDate }),
);

const stringList = (maxItems: number, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return [];
      const items = typeof value === "string" ? value.split(/[\n,;]+/) : Array.isArray(value) ? value : [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of items) {
        if (typeof item !== "string") continue;
        const trimmed = item.trim().slice(0, maxLength);
        if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
        seen.add(trimmed.toLowerCase());
        out.push(trimmed);
      }
      return out.slice(0, maxItems);
    },
    z.array(z.string()),
  );

const accreditationSchema = z.object({
  name: z.string().trim().min(1, "Give the accreditation a name.").max(120),
  reference: optionalText(80),
  expiresAt: optionalDate,
});

export const companyFactsSchema = z.object({
  legalName: optionalText(160),
  tradingName: optionalText(160),
  companyNumber: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() || null : (value ?? null)),
    z
      .string()
      .regex(/^[A-Z0-9]{6,8}$/, "A Companies House number has 8 characters, for example 01234567 or SC123456.")
      .nullable(),
  ),
  website: optionalText(200),
  turnoverBand: z.preprocess((value) => (value === "" || value === undefined ? null : value), z.enum(TURNOVER_BANDS).nullable()),
  employees: optionalNumber(0, 1_000_000),
  yearsTrading: optionalNumber(0, 500),
  insurance: z.preprocess(
    (value) => value ?? {},
    z.object({ publicLiability: coverSchema, employersLiability: coverSchema, professionalIndemnity: coverSchema }),
  ),
  accreditations: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && String((item as { name?: unknown }).name ?? "").trim() !== "") : []),
    z.array(accreditationSchema).max(40, "List at most 40 accreditations."),
  ),
  sectors: stringList(30, 80),
  regions: stringList(30, 80),
  policies: stringList(40, 120),
  notes: optionalText(4000),
});

export type CompanyFactsInput = z.input<typeof companyFactsSchema>;

/** Normalises anything facts-shaped (stored JSON, model output) into a complete object. */
export function normaliseFacts(value: unknown): CompanyFacts {
  const parsed = companyFactsSchema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  // Drop only the fields that fail, keep the rest.
  const source = (value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {}) as Record<string, unknown>;
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete source[key];
  }
  const retry = companyFactsSchema.safeParse(source);
  return retry.success ? retry.data : companyFactsSchema.parse({});
}

export const EMPTY_FACTS: CompanyFacts = companyFactsSchema.parse({});

/** True when the facts hold at least one real value. */
export function factsAreEmpty(facts: CompanyFacts): boolean {
  const { insurance, accreditations, sectors, regions, policies, ...scalars } = facts;
  if (Object.values(scalars).some((value) => value !== null && value !== undefined && value !== "")) return false;
  if ((accreditations?.length ?? 0) + (sectors?.length ?? 0) + (regions?.length ?? 0) + (policies?.length ?? 0) > 0) return false;
  return !Object.values(insurance ?? {}).some((cover) => cover && cover.amountGbp !== null);
}

export type ExpiryWarning = { label: string; date: string; state: "expired" | "soon" };

/** Insurance renewals and accreditations that have expired or expire within `days`. */
export function expiryWarnings(facts: CompanyFacts, today: Date = new Date(), days = 60): ExpiryWarning[] {
  const warnings: ExpiryWarning[] = [];
  const check = (label: string, date: string | null | undefined) => {
    if (!date) return;
    const time = new Date(`${date}T23:59:59Z`).getTime();
    if (Number.isNaN(time)) return;
    if (time < today.getTime()) warnings.push({ label, date, state: "expired" });
    else if (time < today.getTime() + days * 86_400_000) warnings.push({ label, date, state: "soon" });
  };
  check("Public liability insurance", facts.insurance?.publicLiability?.expiresAt);
  check("Employers' liability insurance", facts.insurance?.employersLiability?.expiresAt);
  check("Professional indemnity insurance", facts.insurance?.professionalIndemnity?.expiresAt);
  for (const accreditation of facts.accreditations ?? []) check(accreditation.name, accreditation.expiresAt);
  return warnings.sort((a, b) => a.date.localeCompare(b.date));
}
