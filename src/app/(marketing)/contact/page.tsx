import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/marketing/section";
import { identity, site } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach ${site.name}: support, corrections to a public page, privacy requests and billing.`,
  alternates: { canonical: "/contact" },
};

const { operator } = site;

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-10 gap-y-1.5 border-t border-line py-5 sm:grid-cols-[15rem_1fr] md:py-6">
      <dt className="text-17 font-semibold text-ink">{title}</dt>
      <dd className="type-reading flex flex-col gap-2 text-ink">{children}</dd>
    </div>
  );
}

const Mail = ({ address }: { address: string }) => <a href={`mailto:${address}`}>{address}</a>;

export default function ContactPage() {
  return (
    <div className="container-content pt-10 pb-14 md:pt-16 md:pb-24">
      <div className="max-w-[52.5rem]">
        <Eyebrow>Contact</Eyebrow>
        <h1 className="type-h1 mt-3 text-ink">Talk to the person who builds it.</h1>
        <p className="type-lead mt-4 max-w-[42.5rem] text-ink">
          {site.name} is built and run by one person, {operator.name}. Write by email and a person replies, usually within one working day.
        </p>

        <dl className="mt-10 border-b border-line">
          <Row title="Support and questions">
            <p>
              <Mail address={site.supportEmail} />
            </p>
            <p>Say which workspace you are writing about. Do not send tender documents by email: upload them in the app, where they stay private.</p>
          </Row>
          <Row title="Correct or remove a public page">
            <p>
              If a supplier, buyer or tender page shows something wrong about your organisation, or you want a page removed, write to <Mail address={site.supportEmail} />{" "}
              with the address of the page. We act within five working days.
            </p>
          </Row>
          <Row title="Stop emails from us">
            <p>
              If we emailed your business about its public contracts, use the <Link href="/optout">opt‑out page</Link> or reply to the email. We will not contact you
              again.
            </p>
          </Row>
          <Row title="Privacy requests and complaints">
            <p>
              <Mail address={operator.privacyEmail} />
            </p>
            <p>
              For a copy of your data, a correction, a deletion or a data protection complaint. We acknowledge complaints within 30 days. See the{" "}
              <Link href="/legal/privacy">privacy notice</Link>.
            </p>
            {/* Pending until a representative is appointed (site.operator.ukRepresentative): say so, and give the address that works today. */}
            <p data-testid="uk-representative">
              {operator.ukRepresentative ? (
                <>UK representative: {operator.ukRepresentative}</>
              ) : (
                <>
                  UK representative: being appointed — contact <Mail address={site.supportEmail} />
                </>
              )}
            </p>
          </Row>
          <Row title="Billing, invoices and refunds">
            <p>
              Payments are processed by Paddle, our merchant of record. Use the link in your Paddle receipt to get an invoice or update a card, or write to us and we
              will help. Refunds are covered in the <Link href="/legal/refunds">refund policy</Link>.
            </p>
          </Row>
          <Row title="Who we are">
            <address data-testid="operator-details" className="not-italic">
              {operator.legalName}
              <br />
              <span lang="uk">{operator.legalNameLocal}</span>
              <br />
              {operator.address.line1}
              <br />
              {operator.address.city}, {operator.address.region}
              <br />
              {operator.address.country}
              {operator.registrationNumber ? (
                <>
                  <br />
                  Registration no. {operator.registrationNumber}
                </>
              ) : null}
            </address>
            <p>
              {site.name} is the trading name of {operator.name}, a {operator.legalForm} registered in {operator.address.country}. {identity.independence}
            </p>
          </Row>
        </dl>
      </div>
    </div>
  );
}
