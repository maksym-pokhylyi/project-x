import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Data Processing Agreement", alternates: { canonical: "/legal/dpa" } };

const { company } = site;

const sections: LegalSection[] = [
  {
    heading: "Parties and scope",
    body: [
      `This Data Processing Agreement ("DPA") forms part of the Terms of Service between ${company.legalName} ("Processor") and the customer ("Controller"). It applies where the Processor processes personal data on behalf of the Controller in providing ${site.name}.`,
    ],
  },
  {
    heading: "Details of the processing",
    body: [
      [
        "Subject matter and duration: provision of the Service for the term of the subscription.",
        "Nature and purpose: hosting, storage, transmission and display of data the Controller submits; support.",
        "Categories of data subjects: the Controller's users and the individuals whose data the Controller submits.",
        "Categories of personal data: contact details, account identifiers and the content submitted by the Controller. [[DESCRIBE_PRODUCT_SPECIFIC_DATA]]",
        "Special categories of data: none intended; the Controller must not submit them unless agreed in writing.",
      ],
    ],
  },
  {
    heading: "Processor obligations",
    body: [
      "The Processor will:",
      [
        "process personal data only on the Controller's documented instructions, including these Terms, unless required by law;",
        "ensure that persons authorised to process the data are bound by confidentiality;",
        "implement the technical and organisational measures described below;",
        "assist the Controller, at its request, with data subject requests, impact assessments and consultations with authorities;",
        "notify the Controller without undue delay, and in any case within 72 hours, after becoming aware of a personal data breach;",
        "delete or return personal data at the end of the Service, as described in the Terms.",
      ],
    ],
  },
  {
    heading: "Sub-processors",
    body: [
      "The Controller authorises the sub-processors listed in the Privacy Policy. The Processor will give at least 14 days' notice of a new sub-processor, during which the Controller may object on reasonable data-protection grounds; if the objection cannot be resolved the Controller may terminate the affected Service.",
      "The Processor imposes data-protection obligations on each sub-processor that are no less protective than this DPA and remains responsible for their performance.",
    ],
  },
  {
    heading: "Security measures",
    body: [
      [
        "Encryption of data in transit (TLS) and at rest at the infrastructure providers.",
        "Logical separation of customer workspaces and role-based access control inside each workspace.",
        "Authentication with hashed passwords, session expiry and rate limiting of sign-in attempts.",
        "Least-privilege access to production systems, protected by multi-factor authentication.",
        "Audit logging of security-relevant actions, error monitoring and regular dependency updates.",
        "Backups with point-in-time restore at the database provider.",
      ],
    ],
  },
  {
    heading: "International transfers",
    body: [
      "Where personal data subject to the GDPR or UK GDPR is transferred to a country without an adequacy decision, the parties rely on the European Commission's Standard Contractual Clauses (Module Two or Three as applicable) and, for the UK, the International Data Transfer Addendum, which are incorporated by reference.",
    ],
  },
  {
    heading: "Audits",
    body: [
      "The Processor will make available the information reasonably necessary to demonstrate compliance with this DPA and will allow an audit by the Controller or its independent auditor not more than once a year, on 30 days' notice, during business hours and subject to confidentiality.",
    ],
  },
  {
    heading: "Order of precedence and contact",
    body: [
      "If this DPA conflicts with the Terms of Service, this DPA prevails for matters of personal data protection.",
      `Requests for a countersigned copy: ${company.privacyContactEmail}.`,
    ],
  },
];

export default function DpaPage() {
  return (
    <LegalDocument
      title="Data Processing Agreement"
      intro="This agreement sets out how we process personal data on behalf of our customers, as required by Article 28 GDPR and similar laws."
      sections={sections}
    />
  );
}
