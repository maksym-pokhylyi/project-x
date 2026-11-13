import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/legal/terms" } };

const { company } = site;

const sections: LegalSection[] = [
  {
    heading: "Who we are",
    body: [
      `${site.name} (the "Service") is operated by ${company.legalName}, ${company.address}, registration number ${company.registrationNumber} ("we", "us"). These Terms form a contract between us and the business or person that creates an account ("you", "Customer").`,
      "The Service is intended for business use. By creating an account you confirm that you are at least 18 years old and are authorised to accept these Terms on behalf of your organisation.",
    ],
  },
  {
    heading: "Accounts and workspaces",
    body: [
      "You are responsible for the activity in your account and workspaces, for keeping credentials confidential and for the people you invite. Workspace owners and admins decide who has access and with which role.",
      "You must provide accurate information and keep your contact e-mail up to date, because we use it for service and security notices.",
    ],
  },
  {
    heading: "Plans, billing and taxes",
    body: [
      "The Service is offered on free and paid subscription plans described on the pricing page. Paid plans are billed in advance for each monthly or annual period and renew automatically until cancelled.",
      "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all orders: Paddle handles payment, invoicing and applicable sales tax/VAT, and Paddle's buyer terms apply to the purchase in addition to these Terms.",
      "You can change or cancel your plan at any time from the workspace billing settings. A cancellation takes effect at the end of the current billing period; plan limits and features follow the plan that is active at the time. If a payment fails we may limit the workspace to the free plan after a grace period.",
      `Refunds are described in our Refund Policy (${site.domain}/legal/refunds).`,
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "You agree not to, and not to allow others to:",
      [
        "use the Service to break the law, infringe others' rights or process data you have no right to process;",
        "attempt to access other customers' data, probe or circumvent security, limits or rate limits;",
        "resell or provide the Service to third parties without our written consent;",
        "upload malware or use the Service to send spam;",
        "reverse engineer the Service except where the law expressly allows it.",
      ],
      "We may suspend access that endangers the Service or other customers, and will tell you why unless the law prevents it.",
    ],
  },
  {
    heading: "Your data",
    body: [
      "You keep all rights to the content and data you put into the Service (\"Customer Data\"). You grant us only the rights needed to host, process and display it in order to provide and support the Service.",
      "Where we process personal data on your behalf, the Data Processing Agreement applies and forms part of these Terms. Our own use of personal data is described in the Privacy Policy.",
      "You can export or delete Customer Data while your account is active. After an account is closed we delete Customer Data within 30 days, except where we must keep it by law.",
    ],
  },
  {
    heading: "AI-assisted features",
    body: [
      "Some features use third-party AI models to generate output from your input. AI output can be inaccurate or incomplete; you are responsible for reviewing it before relying on it. AI usage is subject to fair-use budgets that depend on your plan.",
      "We do not use Customer Data to train AI models, and we require the same from the model providers we use.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "The Service, including its software, design and documentation, belongs to us and our licensors. Subject to these Terms we grant you a non-exclusive, non-transferable right to use the Service during your subscription.",
      "If you send us feedback, we may use it without obligation to you.",
    ],
  },
  {
    heading: "Availability and changes",
    body: [
      "We work to keep the Service available and secure but do not promise uninterrupted operation. We may change features, and will give reasonable notice of changes that materially reduce functionality of a paid plan.",
    ],
  },
  {
    heading: "Warranties and liability",
    body: [
      "The Service is provided \"as is\". To the extent permitted by law we exclude all implied warranties.",
      "To the extent permitted by law, our total liability arising out of these Terms in any 12-month period is limited to the fees you paid for the Service in that period, and neither party is liable for indirect or consequential losses, loss of profits, revenue or data. Nothing in these Terms limits liability that cannot be limited by law.",
    ],
  },
  {
    heading: "Term and termination",
    body: [
      "These Terms apply while you have an account. You may stop using the Service and close your account at any time. We may terminate or suspend an account that materially breaches these Terms and does not cure the breach within 14 days of notice, or immediately where the breach is serious.",
    ],
  },
  {
    heading: "Governing law",
    body: [
      `These Terms are governed by the laws of ${company.governingLaw}. The courts of ${company.governingLaw} have exclusive jurisdiction, without prejudice to any mandatory rights you have under the law of your country.`,
    ],
  },
  {
    heading: "Changes to these Terms and contact",
    body: [
      "We may update these Terms. We will notify workspace owners by e-mail at least 14 days before a material change takes effect. Continued use after that date means you accept the updated Terms.",
      `Questions: ${site.supportEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro={`These Terms govern your use of ${site.name}. Please read them together with our Privacy Policy, Refund Policy and Data Processing Agreement.`}
      sections={sections}
    />
  );
}
