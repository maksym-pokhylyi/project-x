import type { Metadata } from "next";
import { CheckoutStatus } from "@/components/billing/checkout-status";
import { TestModeNotice } from "@/components/billing/test-mode-notice";
import { PLANS, PLAN_KEYS } from "@/config/plans";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Payment confirmation" };

export default async function CheckoutSuccessPage() {
  await requireOrgForPage({ role: "owner" });
  const planNames = Object.fromEntries(PLAN_KEYS.map((key) => [key, PLANS[key].name]));
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4">
      <TestModeNotice />
      <CheckoutStatus planNames={planNames} />
    </div>
  );
}
