import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach the ${site.name} team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <p className="mt-3 text-muted-foreground">We read every message and usually reply within one business day.</p>

      <dl className="mt-8 divide-y rounded-xl border bg-card text-sm">
        <div className="grid gap-1 p-4 sm:grid-cols-3">
          <dt className="font-medium">Support &amp; sales</dt>
          <dd className="sm:col-span-2">
            <a className="underline underline-offset-4" href={`mailto:${site.supportEmail}`}>
              {site.supportEmail}
            </a>
          </dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-3">
          <dt className="font-medium">Privacy requests</dt>
          <dd className="sm:col-span-2">{site.company.privacyContactEmail}</dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-3">
          <dt className="font-medium">Company</dt>
          <dd className="sm:col-span-2">
            {site.company.legalName}
            <br />
            {site.company.address}
            <br />
            Registration no. {site.company.registrationNumber}
          </dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-3">
          <dt className="font-medium">Billing questions</dt>
          <dd className="sm:col-span-2">
            Payments, invoices and refunds are handled by Paddle, our merchant of record. Use the link in your receipt
            or write to us and we will help.
          </dd>
        </div>
      </dl>
    </div>
  );
}
