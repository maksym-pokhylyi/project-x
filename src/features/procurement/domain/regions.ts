/**
 * Region codes as published in the feed: "UK" (whole country), then 3–5 character codes
 * such as "UKI" (London) or "UKK14" (Swindon). Non-UK deliveries carry a bare country
 * code. We match on the 3-character top level and treat "UK" as nationwide.
 */
export const UK_REGIONS: Record<string, string> = {
  UKC: "North East",
  UKD: "North West",
  UKE: "Yorkshire and the Humber",
  UKF: "East Midlands",
  UKG: "West Midlands",
  UKH: "East of England",
  UKI: "London",
  UKJ: "South East",
  UKK: "South West",
  UKL: "Wales",
  UKM: "Scotland",
  UKN: "Northern Ireland",
};

export const NATIONWIDE = "UK";
/** Delivery wholly outside the UK (an embassy contract, an overseas base). */
export const ABROAD = "ZZ";

/** Top-level region of a published code: "UKK14" -> "UKK", "UK" -> "UK", "FR" -> null. */
export function topRegion(code: string | null | undefined): string | null {
  if (!code) return null;
  const value = code.trim().toUpperCase();
  if (value === "UK" || value === "GB") return NATIONWIDE;
  if (/^UK[C-N]/.test(value)) return value.slice(0, 3);
  return null;
}

/**
 * Distinct top-level regions for a list of published codes. Twelve regions collapse to "UK";
 * codes that are all foreign countries give ["ZZ"].
 */
export function topRegions(codes: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  let foreign = 0;
  for (const code of codes) {
    const top = topRegion(code);
    if (top) out.add(top);
    else if (code && /^[A-Z]{2}$/.test(code.trim().toUpperCase())) foreign += 1;
  }
  if (out.size === 0 && foreign > 0) return [ABROAD];
  const specific = [...out].filter((value) => value !== NATIONWIDE);
  if (specific.length >= Object.keys(UK_REGIONS).length) return [NATIONWIDE];
  return [...out].sort();
}

export function regionLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === NATIONWIDE) return "UK-wide";
  if (code === ABROAD) return "Outside the UK";
  return UK_REGIONS[code.slice(0, 3)] ?? null;
}

/** "London", "London and South East", "London, South East and 2 more", "UK-wide". */
export function regionsLabel(codes: string[] | null | undefined): string | null {
  const list = (codes ?? []).filter(Boolean);
  if (list.length === 0) return null;
  const specific = list.filter((code) => code !== NATIONWIDE && code !== ABROAD).map((code) => UK_REGIONS[code]).filter((label): label is string => Boolean(label));
  if (specific.length === 0) return list.includes(NATIONWIDE) ? "UK-wide" : list.includes(ABROAD) ? "Outside the UK" : null;
  if (specific.length === 1) return specific[0]!;
  if (specific.length === 2) return `${specific[0]} and ${specific[1]}`;
  return `${specific[0]}, ${specific[1]} and ${specific.length - 2} more`;
}
