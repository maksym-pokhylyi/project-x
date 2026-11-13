import type { OcdsValue } from "./ocds";

/**
 * Values in the feed (docs/domain/fts-data-profile.md §4.2, §6):
 *  - `amount` is net of VAT, `amountGross` includes it; 15% of contract notices carry gross only;
 *  - £0, £1 and other tiny figures are placeholders, not prices;
 *  - framework ceilings of £1bn+ appear on ordinary-looking notices.
 */
export const PLACEHOLDER_MAX = 1000;
export const CEILING_MIN = 1_000_000_000;

export type CleanValue = {
  /** Best single figure for display and comparison: net when published, otherwise gross. Null when unknown. */
  amount: number | null;
  gross: number | null;
  currency: string | null;
  basis: "net" | "gross" | null;
  /** A figure was published but is a placeholder (£0, £1 …). */
  placeholder: boolean;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function cleanValue(value: OcdsValue | null | undefined, fallbackCurrency: string | null = null): CleanValue {
  const net = finite(value?.amount);
  const gross = finite(value?.amountGross);
  const currency = (value?.currency ?? fallbackCurrency ?? null)?.toUpperCase() ?? null;
  const best = net ?? gross;
  if (best === null) return { amount: null, gross: null, currency, basis: null, placeholder: false };
  if (best <= PLACEHOLDER_MAX) return { amount: null, gross: null, currency, basis: null, placeholder: true };
  return {
    amount: Math.round(best * 100) / 100,
    gross: gross !== null && gross > PLACEHOLDER_MAX ? Math.round(gross * 100) / 100 : null,
    currency: currency ?? "GBP",
    basis: net !== null ? "net" : "gross",
    placeholder: false,
  };
}

const SYMBOLS: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

/** "£102k", "£1.2m", "£3.4bn", "£850"; null when there is nothing honest to show. */
export function formatMoneyShort(amount: number | null | undefined, currency: string | null = "GBP"): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const code = (currency ?? "GBP").toUpperCase();
  const symbol = SYMBOLS[code];
  let body: string;
  if (amount >= 1_000_000_000) body = `${trim(amount / 1_000_000_000, amount >= 10_000_000_000 ? 0 : 1)}bn`;
  else if (amount >= 1_000_000) body = `${trim(amount / 1_000_000, amount >= 100_000_000 ? 0 : 1)}m`;
  else if (amount >= 10_000) body = `${Math.round(amount / 1000)}k`;
  else if (amount >= 1000) body = `${trim(amount / 1000, 1)}k`;
  else body = String(Math.round(amount));
  return symbol ? `${symbol}${body}` : `${body} ${code}`;
}

/**
 * Money in a row, as the artboards write it: one decimal place above a million ("£4.2m",
 * "£1.2bn") and the exact figure in whole pounds below it ("£780,000"). Null when there is
 * nothing honest to show — say "Value not published" instead.
 */
export function formatMoney(amount: number | null | undefined, currency: string | null = "GBP"): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000) return formatMoneyShort(amount, currency);
  return formatMoneyExact(Math.round(amount), currency);
}

/** "£102,340" — the exact figure for hover/focus and screen readers. */
export function formatMoneyExact(amount: number | null | undefined, currency: string | null = "GBP"): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const code = (currency ?? "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("en-GB")} ${code}`;
  }
}
