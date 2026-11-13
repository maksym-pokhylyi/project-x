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

/**
 * The 41 areas one level below the regions (ITL 2, formerly NUTS 2), keyed by the first four
 * characters of a published code: "UKE42" (Leeds) and "UKE4" are both West Yorkshire. Buyers
 * publish delivery places at this depth or deeper in about half of all notices, which is
 * what lets a chip say "West Yorkshire" instead of "Yorkshire and the Humber". The five
 * London areas are shown as "London": "Outer London – West and North West" helps nobody.
 */
export const UK_AREAS: Record<string, string> = {
  UKC1: "Tees Valley and Durham",
  UKC2: "Northumberland and Tyne and Wear",
  UKD1: "Cumbria",
  UKD3: "Greater Manchester",
  UKD4: "Lancashire",
  UKD6: "Cheshire",
  UKD7: "Merseyside",
  UKE1: "East Yorkshire and Northern Lincolnshire",
  UKE2: "North Yorkshire",
  UKE3: "South Yorkshire",
  UKE4: "West Yorkshire",
  UKF1: "Derbyshire and Nottinghamshire",
  UKF2: "Leicestershire, Rutland and Northamptonshire",
  UKF3: "Lincolnshire",
  UKG1: "Herefordshire, Worcestershire and Warwickshire",
  UKG2: "Shropshire and Staffordshire",
  UKG3: "West Midlands",
  UKH1: "East Anglia",
  UKH2: "Bedfordshire and Hertfordshire",
  UKH3: "Essex",
  UKI3: "London",
  UKI4: "London",
  UKI5: "London",
  UKI6: "London",
  UKI7: "London",
  UKJ1: "Berkshire, Buckinghamshire and Oxfordshire",
  UKJ2: "Surrey, East and West Sussex",
  UKJ3: "Hampshire and Isle of Wight",
  UKJ4: "Kent",
  UKK1: "Gloucestershire, Wiltshire and Bristol/Bath area",
  UKK2: "Dorset and Somerset",
  UKK3: "Cornwall and Isles of Scilly",
  UKK4: "Devon",
  UKL1: "West Wales and The Valleys",
  UKL2: "East Wales",
  UKM5: "North Eastern Scotland",
  UKM6: "Highlands and Islands",
  UKM7: "Eastern Scotland",
  UKM8: "West Central Scotland",
  UKM9: "Southern Scotland",
  UKN0: "Northern Ireland",
};

/** Area of a published code: "UKE42" -> "West Yorkshire"; null for a code no deeper than a region. */
export function areaLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const value = code.trim().toUpperCase();
  return value.length >= 4 ? (UK_AREAS[value.slice(0, 4)] ?? null) : null;
}

/**
 * Where a notice is delivered, as specifically as it was published: one or two areas by
 * name ("West Yorkshire", "Kent and Essex"), otherwise the regions ("London, South East
 * and 2 more", "UK-wide"). `regionCodes` are the codes as published; `regions` the top-level
 * regions derived from them (or from the buyer's address when the notice gives none).
 */
export function placeLabel(regionCodes: readonly string[] | null | undefined, regions: string[] | null | undefined): string | null {
  const codes = (regionCodes ?? []).filter(Boolean);
  const areas = [...new Set(codes.map(areaLabel).filter((label): label is string => Boolean(label)))];
  // Only when every published place is that specific: "UKE4" next to a bare "UKJ" is two regions, not one area.
  const allSpecific = codes.length > 0 && codes.every((code) => areaLabel(code) !== null);
  if (allSpecific && areas.length === 1) return areas[0]!;
  if (allSpecific && areas.length === 2) return `${areas[0]} and ${areas[1]}`;
  return regionsLabel(regions);
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
