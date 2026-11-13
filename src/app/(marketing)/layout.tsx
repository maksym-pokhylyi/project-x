import type { ReactNode } from "react";
import { JsonLd, organizationJsonLd } from "@/components/marketing/json-ld";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { appUrl } from "@/env";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={organizationJsonLd(appUrl)} />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
