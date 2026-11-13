import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { operatorAddress, operatorLegalName, site } from "@/config/site";

export const metadata: Metadata = {
  title: "Data processing agreement",
  description: `How ${site.name} processes personal data on behalf of its customers: scope, instructions, sub-processors, security measures, transfers and deletion.`,
  alternates: { canonical: "/legal/dpa" },
};

const { operator, facts } = site;

const summary = [
  "This agreement applies to personal data inside what you upload: tender packs, library documents, company facts and drafts.",
  "We process it only to provide the Service to you, never to train AI models, and we delete it when you delete it or close the workspace.",
  "It does not cover the business contact details we take from public notices, or your own account details: for those we are the controller, and the [privacy notice](/legal/privacy) applies.",
];

const sections: LegalSection[] = [
  {
    heading: "Parties and scope",
    id: "scope",
    body: [
      `This data processing agreement (“DPA”) forms part of the [Terms of Service](/legal/terms) between ${operatorLegalName}, of ${operatorAddress} (“Processor”, “we”) and the customer (“Controller”, “you”). It applies where we process personal data on your behalf in providing ${site.name}.`,
      "It reflects Article 28 of the UK GDPR and of the EU GDPR. Where those laws do not apply to you, it applies as a contractual commitment.",
    ],
  },
  {
    heading: "Details of the processing",
    id: "details",
    body: [
      {
        table: {
          head: ["Item", "Description"],
          rows: [
            ["Subject matter", "Providing the Service: reading tender packs and library documents, producing bid checks, drafts and markings, and storing them for your workspace"],
            ["Duration", "For as long as you have an account, and until deletion as set out in section 9"],
            ["Nature and purpose", "Storage, text extraction, analysis by AI models, display, export and support"],
            ["Data subjects", "Your staff and contractors; people named in the documents you upload, such as referees, buyer contacts and employees listed for transfer"],
            ["Categories of personal data", "Names, job titles, work contact details, qualifications and career history, and whatever else your documents contain"],
            ["Special categories", "None intended. Do not upload documents containing health data, criminal-record data or other special-category data unless we have agreed it in writing"],
          ],
        },
      },
      {
        note: "Tender packs sometimes include staff lists for a transfer of employment, with pay and personal details. Remove or redact such lists before you upload a pack: the Service does not need them.",
      },
    ],
  },
  {
    heading: "Our obligations as processor",
    id: "obligations",
    body: [
      "We will:",
      [
        "process personal data only on your documented instructions, which are these terms and the way you use the Service, unless the law requires otherwise, in which case we tell you first where the law allows;",
        "not use it for our own purposes, and in particular not use it, or allow it to be used, to train AI models;",
        "make sure that anyone we authorise to process it is bound by confidentiality;",
        "apply the security measures in section 5;",
        "help you, at your request, to answer requests from data subjects and to carry out impact assessments;",
        "tell you without undue delay, and in any case within 72 hours, after we become aware of a personal data breach affecting your data;",
        "delete or return the data at the end of the Service as set out in section 9.",
      ],
    ],
  },
  {
    heading: "Sub-processors",
    id: "sub-processors",
    body: [
      "You authorise us to use the following sub-processors:",
      {
        table: {
          head: ["Sub-processor", "Processing", "Location"],
          rows: [
            ["Vercel Inc.", "Application hosting, file storage, AI gateway", `${facts.hostingRegion}; United States for some services`],
            ["Neon Inc.", "Database hosting", facts.hostingRegion],
            ["AI model providers reached through the Vercel AI Gateway", "Analysis of document text and prompts, without use for model training", "[[CONFIRM_AI_PROVIDER_LOCATIONS]]"],
            ["Resend, Inc.", "Delivery of service emails", "United States"],
          ],
        },
      },
      "We will tell workspace owners at least 14 days before we add or replace a sub-processor. You may object on reasonable data-protection grounds within that time; if we cannot resolve the objection, you may end the affected Service and we refund any fees paid for the period after it ends.",
      "We place on each sub-processor data-protection obligations no less protective than this DPA, and we remain responsible for what they do.",
    ],
  },
  {
    heading: "Security measures",
    id: "security",
    body: [
      [
        "Encryption of data in transit (TLS), and at rest at our infrastructure providers.",
        "Separation of customer workspaces, and role-based access inside each workspace.",
        "Uploaded files served only to signed-in members of the workspace that owns them.",
        "Passwords stored as salted hashes; sessions that expire; rate limiting of sign-in attempts.",
        "Least-privilege access to production systems, protected by multi-factor authentication.",
        "Logging of security-relevant actions, error monitoring and regular dependency updates.",
        "Database backups with point-in-time restore at the database provider.",
      ],
      "[[CONFIRM_SECURITY_MEASURES: the founder must confirm that each measure above is in place before launch]]",
    ],
  },
  {
    heading: "International transfers",
    id: "transfers",
    body: [
      `We operate from ${facts.operatorCountry} and some sub-processors process data outside the United Kingdom and the European Economic Area.`,
      "Where personal data protected by the UK GDPR or the EU GDPR is transferred to a country without an adequacy decision, the parties rely on the European Commission’s Standard Contractual Clauses (Module Two or Three as applicable) and, for the United Kingdom, the International Data Transfer Addendum, which are incorporated by reference. [[CONFIRM_TRANSFER_MECHANISMS_WITH_LAWYER]]",
    ],
  },
  {
    heading: "Your obligations as controller",
    id: "controller",
    body: [
      "You confirm that you have a lawful basis for the personal data you upload, that you have told the people concerned as the law requires, and that you will not upload data you are not entitled to share with a service provider.",
    ],
  },
  {
    heading: "Audits",
    id: "audits",
    body: [
      "We will give you the information reasonably needed to show that we comply with this DPA. You, or an independent auditor bound by confidentiality, may audit our compliance not more than once a year, on 30 days’ notice, during working hours and without disrupting the Service.",
    ],
  },
  {
    heading: "Deletion and return",
    id: "deletion",
    body: [
      "You can delete any file, bid or library document at any time, and export your answers to Word. When a workspace is deleted, or on your written request, we delete its content from live systems without undue delay and from backups within [[CONFIRM_BACKUP_RETENTION_DAYS]] days, unless the law requires us to keep it.",
    ],
  },
  {
    heading: "Order of precedence, and contact",
    id: "precedence",
    body: [
      "If this DPA conflicts with the Terms of Service on a question of personal data, this DPA prevails.",
      `For a countersigned copy, write to ${operator.privacyEmail}.`,
    ],
  },
];

export default function DpaPage() {
  return (
    <LegalDocument
      title="Data processing agreement"
      intro="This agreement sets out how we process personal data on your behalf when you use the Service, as Article 28 of the UK GDPR requires."
      summary={summary}
      sections={sections}
    />
  );
}
