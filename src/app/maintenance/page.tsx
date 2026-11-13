import type { Metadata } from "next";
import { SystemPage } from "@/components/system-page";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Back shortly", robots: { index: false } };

/**
 * Maintenance page. Static, with no data access, so it can be served while the database or
 * a deployment is unavailable: point a rewrite or the hosting platform's maintenance mode at
 * /maintenance. Nothing links here in normal operation.
 */
export default function MaintenancePage() {
  return (
    <SystemPage
      code="Maintenance"
      title="Back shortly"
      reference={
        <>
          Working to a tender deadline and need something from your workspace? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </>
      }
    >
      <p>{site.name} is being updated. This usually takes a few minutes. Your radar, bids and files are safe.</p>
      <p>The official Find a Tender service is not affected: tender notices and deadlines there are unchanged.</p>
    </SystemPage>
  );
}
