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

/** True when a YYYY-MM-DD date (end of that day, UTC) is in the past. */
export function isPastDate(date: string | null | undefined, now: number = Date.now()): boolean {
  if (!date) return false;
  const time = new Date(`${date.slice(0, 10)}T23:59:59Z`).getTime();
  return !Number.isNaN(time) && time < now;
}

/** True when `date` is less than `ms` old. */
export function isRecent(date: Date, ms: number, now: number = Date.now()): boolean {
  return now - date.getTime() < ms;
}
