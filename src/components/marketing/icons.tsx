import { ChartNoAxesColumn, LifeBuoy, Plug, ShieldCheck, Users, Zap, type LucideIcon } from "lucide-react";
import type { LandingIcon } from "@/config/landing";

/** Maps the icon names used in src/config/landing.ts to lucide icons. */
export const landingIcons: Record<LandingIcon, LucideIcon> = {
  zap: Zap,
  users: Users,
  shield: ShieldCheck,
  chart: ChartNoAxesColumn,
  plug: Plug,
  "life-buoy": LifeBuoy,
};
