/** Client-safe helpers for citation locations ("p12", "s3", "sheet:Pricing"). */

/** Page number of a "p12" location, or null for sections and sheets. */
export function pageFromLoc(loc: string): number | null {
  const match = /^p(\d{1,5})$/.exec(loc.trim());
  return match ? Number(match[1]) : null;
}

/** "Page 12", "Section 3", "Sheet Pricing" — how a location is shown to people. */
export function describeLoc(loc: string): string {
  const page = /^p(\d+)$/.exec(loc);
  if (page) return `page ${page[1]}`;
  const section = /^s(\d+)$/.exec(loc);
  if (section) return `section ${section[1]}`;
  if (loc.startsWith("sheet:")) return `sheet “${loc.slice(6)}”`;
  return loc;
}
