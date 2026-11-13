import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy" } };

const { company } = site;

const sections: LegalSection[] = [
  {
    heading: "Who is responsible",
    body: [
      `The controller of the personal data described here is ${company.legalName}, ${company.address} (${company.country}). Contact for privacy matters: ${company.privacyContactEmail}.`,
      "For the content your organisation stores in the Service we act as a processor on behalf of your organisation; that processing is governed by the Data Processing Agreement.",
    ],
  },
  {
    heading: "What we collect",
    body: [
      [
        "Account data: name, e-mail address, password hash, and (if you use it) the identifier from your Google sign-in.",
        "Workspace data: workspace name and logo, memberships, roles and invitations.",
        "Billing data: plan, subscription status and billing contact e-mail. Card and payment details are collected and stored by Paddle, not by us.",
        "Usage and technical data: actions taken in the product, usage counters, IP address, browser type, and logs needed for security and troubleshooting.",
        "Support data: messages you send us.",
      ],
    ],
  },
  {
    heading: "Why we use it and on what basis",
    body: [
      [
        "To provide the Service and your account (performance of contract).",
        "To bill for paid plans and prevent fraud (contract; legitimate interests; legal obligations).",
        "To secure the Service, enforce limits and debug problems (legitimate interests).",
        "To understand product usage and improve the Service (legitimate interests; consent where required).",
        "To send service, security and transactional e-mails (contract; legitimate interests).",
      ],
      "We do not sell personal data and do not use it for advertising.",
    ],
  },
  {
    heading: "Service providers (sub-processors)",
    body: [
      "We share data only with providers that help us run the Service, under contracts that require them to protect it:",
      [
        "Vercel Inc. — application hosting, file storage and AI gateway.",
        "Neon Inc. — managed PostgreSQL database.",
        "Paddle.com Market Ltd. — payments, invoicing and tax as merchant of record.",
        "Resend, Inc. — transactional e-mail delivery.",
        "PostHog, Inc. — product analytics (only if enabled).",
        "Functional Software, Inc. (Sentry) — error monitoring (only if enabled).",
        "AI model providers reached through the Vercel AI Gateway — processing of prompts for AI-assisted features.",
      ],
      "Remove the providers you do not use and add any you introduce: [[REVIEW_SUBPROCESSOR_LIST]].",
    ],
  },
  {
    heading: "International transfers",
    body: [
      "Some providers process data outside your country, including in the United States. Where required we rely on adequacy decisions or the European Commission's Standard Contractual Clauses.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use strictly necessary cookies to keep you signed in and to protect against cross-site request forgery. If product analytics is enabled, an analytics cookie or local-storage identifier is used to measure usage. We do not use advertising cookies.",
    ],
  },
  {
    heading: "How long we keep data",
    body: [
      [
        "Account and workspace data: for the life of the account, then deleted within 30 days of closure.",
        "Billing records: as long as required by tax and accounting law.",
        "Security and error logs: up to 90 days unless needed to investigate an incident.",
        "Product analytics events: up to 24 months.",
      ],
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on where you live you may have the right to access, correct, delete or export your personal data, to object to or restrict certain processing, and to withdraw consent. Write to the privacy contact above; we answer within 30 days. You may also complain to your local data protection authority.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Data is encrypted in transit, access is restricted by role, workspaces are logically isolated from each other, and passwords are stored only as salted hashes. No system is perfectly secure; we will notify affected customers of a personal data breach without undue delay.",
    ],
  },
  {
    heading: "Changes",
    body: ["We will post updates here and notify workspace owners by e-mail of material changes."],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro={`This policy explains what personal data ${site.name} collects, why, and what your choices are.`}
      sections={sections}
    />
  );
}
