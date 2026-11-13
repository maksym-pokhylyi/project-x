import type { ReactNode } from "react";
import { SettingsFrame } from "@/components/app/settings-nav";
import { requireOrgForPage } from "@/server/session";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireOrgForPage();
  return <SettingsFrame>{children}</SettingsFrame>;
}
