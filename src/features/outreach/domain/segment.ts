import { z } from "zod";
import { CPV_DIVISIONS } from "@/features/procurement/domain/cpv";
import { UK_REGIONS } from "@/features/procurement/domain/regions";
import { outreachConfig } from "../config";

/**
 * The segment a list is built from (PURE). The same schema validates the builder form, the
 * "Create campaign" request and the `segment` column of outreach_campaigns.
 */
const REGION_KEYS = Object.keys(UK_REGIONS);

const money = z.number().finite().min(0).max(10_000_000_000).nullable();

export const segmentSchema = z
  .object({
    /** CPV divisions (two digits), e.g. "45" construction work. Empty with no groups = every trade. */
    cpvDivisions: z.array(z.string().regex(/^\d{2}$/, "A division is two digits.")).max(60),
    /** CPV groups (three digits), e.g. "797" building-cleaning services. */
    cpvGroups: z.array(z.string().regex(/^\d{3}$/, "A group is three digits.")).max(60),
    /** Where the company is based (top-level region of the address in the notice). Empty = anywhere in the UK. */
    regions: z.array(z.string().refine((value) => REGION_KEYS.includes(value), "Unknown region.")).max(REGION_KEYS.length),
    /** The award must have been published within this many days. */
    publishedWithinDays: z.number().int().min(1, "Use at least 1 day.").max(outreachConfig.publishedWithinDays.max, `Use at most ${outreachConfig.publishedWithinDays.max} days.`),
    /** Contract value band in pounds. With a band set, awards without a figure of their own are left out. */
    valueMin: money,
    valueMax: money,
    /** Role mailboxes only (default), or also addresses that identify a person and are still inside their first-contact window. */
    mailbox: z.enum(["generic", "generic_and_named"]),
    /** Only suppliers the notice marks as small or medium-sized. */
    smeOnly: z.boolean(),
    batchSize: z.number().int().min(1, "List at least one company.").max(outreachConfig.batchSize.max, `A list holds at most ${outreachConfig.batchSize.max} companies.`),
  })
  .refine((segment) => segment.valueMin === null || segment.valueMax === null || segment.valueMin <= segment.valueMax, {
    path: ["valueMax"],
    message: "The top of the band must not be below the bottom.",
  });

export type OutreachSegment = z.infer<typeof segmentSchema>;

export const DEFAULT_SEGMENT: OutreachSegment = {
  cpvDivisions: [],
  cpvGroups: [],
  regions: [],
  publishedWithinDays: outreachConfig.publishedWithinDays.default,
  valueMin: null,
  valueMax: null,
  mailbox: "generic",
  smeOnly: true,
  batchSize: outreachConfig.batchSize.default,
};

/** The first segment of docs/gtm/02-outreach-kit.md §2, as one-click starting points. */
export const SEGMENT_PRESETS: Array<{ label: string; cpvDivisions: string[]; cpvGroups: string[] }> = [
  { label: "Construction and maintenance", cpvDivisions: ["45", "50"], cpvGroups: [] },
  { label: "Cleaning and facilities", cpvDivisions: ["90", "77"], cpvGroups: ["797"] },
  { label: "Health and social care", cpvDivisions: ["85"], cpvGroups: [] },
];

type RawParams = Record<string, string | string[] | undefined>;

const list = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .flatMap((item) => item.split(/[\s,;]+/))
    .map((item) => item.trim())
    .filter(Boolean);
const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")).trim();
const unique = (values: string[]): string[] => [...new Set(values)];

function wholeNumber(text: string, fallback: number): number {
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
}

/** "25000", "25,000", "£25k", "1.5m" -> pounds; "" -> null; anything else -> NaN (reported as a field error). */
export function parsePounds(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, "").toLowerCase();
  if (!cleaned) return null;
  const match = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(cleaned);
  if (!match) return Number.NaN;
  const factor = match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  return Math.round(Number(match[1]) * factor);
}

export type SegmentParse = { segment: OutreachSegment | null; fieldErrors: Record<string, string[]> };

/**
 * Reads a segment from the builder's query string (a plain GET form, so the preview has an
 * address that can be reloaded) or from equivalent form fields. Missing fields take their
 * defaults; invalid ones come back as field errors next to the inputs.
 */
export function segmentFromParams(params: RawParams): SegmentParse {
  const groupsText = list(params.groups);
  const candidate = {
    cpvDivisions: unique(list(params.divisions)).sort(),
    cpvGroups: unique(groupsText).sort(),
    regions: unique(list(params.regions)).sort(),
    publishedWithinDays: wholeNumber(first(params.days), DEFAULT_SEGMENT.publishedWithinDays),
    valueMin: parsePounds(first(params.min)),
    valueMax: parsePounds(first(params.max)),
    mailbox: first(params.mailbox) || DEFAULT_SEGMENT.mailbox,
    smeOnly: first(params.size) !== "any",
    batchSize: wholeNumber(first(params.batch), DEFAULT_SEGMENT.batchSize),
  };
  const result = segmentSchema.safeParse(candidate);
  if (result.success) return { segment: result.data, fieldErrors: {} };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    const message = issue.code === "invalid_type" ? "Enter a number." : issue.message;
    (fieldErrors[key] ??= []).push(message);
  }
  return { segment: null, fieldErrors };
}

/** The query string that `segmentFromParams` reads back to the same segment. */
export function segmentToParams(segment: OutreachSegment): URLSearchParams {
  const params = new URLSearchParams();
  for (const division of segment.cpvDivisions) params.append("divisions", division);
  if (segment.cpvGroups.length > 0) params.set("groups", segment.cpvGroups.join(","));
  for (const region of segment.regions) params.append("regions", region);
  params.set("days", String(segment.publishedWithinDays));
  if (segment.valueMin !== null) params.set("min", String(segment.valueMin));
  if (segment.valueMax !== null) params.set("max", String(segment.valueMax));
  params.set("mailbox", segment.mailbox);
  params.set("size", segment.smeOnly ? "sme" : "any");
  params.set("batch", String(segment.batchSize));
  return params;
}

const pounds = (value: number) => `£${value.toLocaleString("en-GB")}`;

/** One line for lists and default campaign names: "Construction work, Repair and maintenance · last 30 days · generic mailboxes". */
export function describeSegment(segment: OutreachSegment): string {
  const trades = [...segment.cpvDivisions.map((division) => CPV_DIVISIONS[division] ?? `CPV ${division}`), ...segment.cpvGroups.map((group) => `CPV group ${group}`)];
  const parts = [trades.length > 0 ? trades.join(", ") : "Every trade"];
  if (segment.regions.length > 0) parts.push(segment.regions.map((region) => UK_REGIONS[region] ?? region).join(", "));
  parts.push(`last ${segment.publishedWithinDays} ${segment.publishedWithinDays === 1 ? "day" : "days"}`);
  if (segment.valueMin !== null && segment.valueMax !== null) parts.push(`${pounds(segment.valueMin)}–${pounds(segment.valueMax)}`);
  else if (segment.valueMin !== null) parts.push(`from ${pounds(segment.valueMin)}`);
  else if (segment.valueMax !== null) parts.push(`up to ${pounds(segment.valueMax)}`);
  parts.push(segment.mailbox === "generic" ? "generic mailboxes" : "generic and named addresses");
  if (!segment.smeOnly) parts.push("any company size");
  return parts.join(" · ");
}
