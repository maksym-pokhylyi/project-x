"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BILLING_PATH } from "@/lib/billing/handoff";

/**
 * Renders its children on Billing and the pages under it (the checkout confirmation) only.
 * The app layout uses it to place the "Test mode" band across the full width, directly
 * under the top bar, exactly where the Billing artboard has it.
 */
export function OnBillingRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === BILLING_PATH || pathname.startsWith(`${BILLING_PATH}/`) ? <>{children}</> : null;
}
