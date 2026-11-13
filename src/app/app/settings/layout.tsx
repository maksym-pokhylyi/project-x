import type { ReactNode } from "react";
import { SettingsFrame } from "@/components/app/settings-nav";
import { requireOrgForPage } from "@/server/session";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgForPage();
  return <SettingsFrame showBilling={ctx.role === "owner"}>{children}</SettingsFrame>;
}
