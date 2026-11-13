/**
 * CPV (Common Procurement Vocabulary) helpers.
 *
 * A code has 8 digits: 2 = division, 3 = group, 4 = class, 5 = category, the rest add
 * precision. Trailing zeros mean "everything below this level", so 45000000 is the whole
 * construction division. Matching always works on prefixes at several depths
 * (docs/domain/fts-data-profile.md §7: 22% of tenders lead with a division-level code).
 */

export function isCpvCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{8}$/.test(value);
}

/** Significant prefix of a code: trailing zeros removed, never shorter than the division. */
export function cpvStem(code: string): string {
  const stem = code.replace(/0+$/, "");
  return stem.length < 2 ? code.slice(0, 2) : stem;
}

export function cpvDivision(code: string): string {
  return code.slice(0, 2);
}

/** 3-digit group, or null when the code is only a division ("45000000"). */
export function cpvGroup(code: string): string | null {
  return cpvStem(code).length >= 3 ? code.slice(0, 3) : null;
}

/** 4-digit class, or null when the code is broader than a class. */
export function cpvClass(code: string): string | null {
  return cpvStem(code).length >= 4 ? code.slice(0, 4) : null;
}

/** Every prefix the code actually specifies, from the division down to its full stem: "45261000" -> ["45", "452", "4526", "45261"]. */
export function cpvPrefixes(code: string): string[] {
  const depth = cpvStem(code).length;
  const out: string[] = [];
  for (let length = 2; length <= depth; length += 1) out.push(code.slice(0, length));
  return out;
}

/** Distinct values of `pick` over a list of codes, nulls dropped. */
export function distinctCpv(codes: string[], pick: (code: string) => string | null): string[] {
  return [...new Set(codes.map(pick).filter((value): value is string => Boolean(value)))];
}

/** Number of leading digits two codes share within their significant stems (0..8). */
export function sharedCpvDepth(a: string, b: string): number {
  const limit = Math.min(cpvStem(a).length, cpvStem(b).length);
  let depth = 0;
  while (depth < limit && a[depth] === b[depth]) depth += 1;
  return depth;
}

/**
 * Plain-English trade names for CPV divisions — the words a supplier would use for their
 * own line of work, not the regulation's titles. Used in match reasons, filters and the
 * manual radar profile picker.
 */
export const CPV_DIVISIONS: Record<string, string> = {
  "03": "Farming, fishing and forestry products",
  "09": "Fuel, electricity and energy",
  "14": "Mining, metals and aggregates",
  "15": "Food and drink",
  "16": "Agricultural machinery",
  "18": "Clothing, footwear and workwear",
  "19": "Leather, textiles, plastic and rubber materials",
  "22": "Printed matter",
  "24": "Chemical products",
  "30": "Office and computing equipment",
  "31": "Electrical equipment and lighting",
  "32": "Radio, TV and telecoms equipment",
  "33": "Medical equipment and pharmaceuticals",
  "34": "Vehicles and transport equipment",
  "35": "Security, fire, police and defence equipment",
  "37": "Musical instruments, sports goods and toys",
  "38": "Laboratory, optical and precision equipment",
  "39": "Furniture, furnishings and cleaning products",
  "41": "Collected and purified water",
  "42": "Industrial machinery",
  "43": "Mining, quarrying and construction machinery",
  "44": "Construction materials and structures",
  "45": "Construction work",
  "48": "Software packages and information systems",
  "50": "Repair and maintenance",
  "51": "Installation services",
  "55": "Catering, hotel and retail services",
  "60": "Transport services",
  "63": "Travel, storage and transport support",
  "64": "Postal and telecoms services",
  "65": "Public utilities",
  "66": "Financial and insurance services",
  "70": "Real estate services",
  "71": "Architecture, engineering and surveying",
  "72": "IT services",
  "73": "Research and development",
  "75": "Public administration and defence services",
  "76": "Oil and gas industry services",
  "77": "Grounds, forestry and horticultural services",
  "79": "Business services: consulting, legal, recruitment, printing, security",
  "80": "Education and training",
  "85": "Health and social care",
  "90": "Waste, cleaning and environmental services",
  "92": "Recreation, culture and sport",
  "98": "Other community and personal services",
};

export function cpvDivisionLabel(codeOrDivision: string): string {
  return CPV_DIVISIONS[codeOrDivision.slice(0, 2)] ?? "Other goods and services";
}

/** "Grounds maintenance services" -> "grounds maintenance"; tidies official labels for use mid-sentence. */
export function shortCpvLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const cleaned = label
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const trimmed = cleaned.replace(/\s+(services|work|works)$/i, (match) => (cleaned.split(" ").length > 2 ? "" : match));
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
