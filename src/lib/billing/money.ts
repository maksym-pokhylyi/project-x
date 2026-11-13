/**
 * Amounts as Paddle reports them: integers in the currency's lowest denomination
 * ("14900" = £149.00, "1000" JPY = ¥1,000). PURE module, safe to import anywhere.
 */

/** Decimal places of a currency's minor unit (GBP 2, JPY 0); 2 when the code is unknown. */
export function minorUnitDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** "£149.00" · "US$29.00" · "¥1,000" — an amount in minor units, formatted for display. */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  const value = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}
