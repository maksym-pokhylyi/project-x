import type { ReactNode } from "react";
import { SettingsNav } from "@/components/app/settings-nav";
import { requireOrgForPage } from "@/server/session";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  return (
    <div className="space-y-6">
      <SettingsNav showBilling={ctx.role === "owner"} />
      {children}
    </div>
  );
}
