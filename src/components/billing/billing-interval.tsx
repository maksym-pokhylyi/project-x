"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { BillingInterval } from "@/config/plans";

type IntervalState = readonly [BillingInterval, (interval: BillingInterval) => void];

const BillingIntervalContext = createContext<IntervalState | null>(null);

/**
 * Shares the Monthly / Annual choice between the plan cards and anything else on the page
 * that quotes a price (the heads of the comparison table). Wrap the page content in it;
 * without a provider each <PricingTable> keeps its own state.
 */
export function BillingIntervalProvider({ defaultInterval = "month", children }: { defaultInterval?: BillingInterval; children: ReactNode }) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const value = useMemo(() => [interval, setInterval] as const, [interval]);
  return <BillingIntervalContext.Provider value={value}>{children}</BillingIntervalContext.Provider>;
}

/** The shared billing period, or a local one when the page has no provider. */
export function useBillingInterval(defaultInterval: BillingInterval = "month"): IntervalState {
  const shared = useContext(BillingIntervalContext);
  const local = useState<BillingInterval>(defaultInterval);
  return shared ?? local;
}
