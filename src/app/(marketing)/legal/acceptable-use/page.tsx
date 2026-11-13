import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Acceptable use policy",
  description: `What you may and may not do with ${site.name}: honest bids, your own documents, no bulk copying of pages and no misuse of the data.`,
  alternates: { canonical: "/legal/acceptable-use" },
};

const summary = [
  "Use the Service to prepare honest bids for your own business or, on Bid Desk Plus, for your clients.",
  "Upload only documents you are entitled to share with a service provider.",
  "Do not use it to invent evidence, to reach other customers’ data, or to copy our pages in bulk.",
];

const sections: LegalSection[] = [
  {
    heading: "Who this applies to",
    id: "scope",
    body: [
      `This policy applies to everyone who uses ${site.name}, including people who only visit the public pages. It forms part of the [Terms of Service](/legal/terms).`,
    ],
  },
  {
    heading: "Honest bids",
    id: "honest-bids",
    body: [
      "The Service drafts answers from the evidence in your library, and marks where evidence is missing. You must not use it to:",
      [
        "invent or misstate accreditations, insurance, turnover, experience, references, case studies or staff qualifications;",
        "remove an “Evidence needed” marker from a statement you cannot support, and submit that statement;",
        "pass off another organisation’s work or documents as your own;",
        "hide the use of AI from a buyer who has asked you to disclose it, or act against a buyer’s stated rules on AI.",
      ],
      "You remain responsible for every statement you submit to a buyer.",
    ],
  },
  {
    heading: "Documents you upload",
    id: "uploads",
    body: [
      [
        "Upload only documents you are entitled to use and to share with a service provider. Check the confidentiality terms of a tender pack before you upload it.",
        "Do not upload special-category personal data, such as health or criminal-record information. Remove or redact staff transfer lists.",
        "Do not upload malware, or files designed to disrupt or probe the Service.",
        "Do not upload material that is unlawful, or that infringes someone else’s rights.",
      ],
    ],
  },
  {
    heading: "Accounts and security",
    id: "security",
    body: [
      "You must not:",
      [
        "try to access another customer’s workspace, files or data;",
        "probe, scan or test the Service for weaknesses, or get round limits, quotas or rate limits. If you find a security problem, please tell us at " +
          site.supportEmail +
          ";",
        "share one seat between several people, or create accounts by automated means;",
        "claim a supplier page for a company you are not authorised to act for;",
        "resell the Service or provide it to third parties, except client work on a plan that includes client workspaces.",
      ],
    ],
  },
  {
    heading: "Public pages and data",
    id: "public-data",
    body: [
      "The public pages are built from open data that anyone may reuse from its official source under the Open Government Licence. Our pages, their layout and the way the data is organised are ours. You must not:",
      [
        "copy pages or data from the Service in bulk, by scraping or any other automated means;",
        "present information from the Service as an official record, or in a way that suggests an official source endorses you;",
        "use the Service to harass a buyer, a supplier or any person, or to send unsolicited marketing to individuals.",
      ],
      "Ordinary use is welcome: reading pages, linking to them and quoting figures with attribution.",
    ],
  },
  {
    heading: "Fair use of AI features",
    id: "fair-use",
    body: [
      "AI processing costs money each time it runs. Plans include a fair-use allowance that is ample for the bids a plan covers. Do not use the Service to process documents that are not tender documents or bid evidence, or to generate content unrelated to bidding.",
      "Do not try to make the Service produce unlawful, deceptive or abusive content, or to extract its prompts or other customers’ content.",
    ],
  },
  {
    heading: "What happens if this policy is broken",
    id: "enforcement",
    body: [
      "We may remove content, limit a feature, suspend a workspace or close an account. Where we can, we tell you first and give you the chance to put things right. Where a breach is serious, unlawful or puts others at risk, we may act at once.",
      `To report misuse, write to ${site.supportEmail}.`,
    ],
  },
];

export default function AcceptableUsePage() {
  return (
    <LegalDocument
      title="Acceptable use policy"
      intro={`${site.name} is a tool for preparing honest, well-evidenced bids. This policy says what that means in practice.`}
      summary={summary}
      sections={sections}
    />
  );
}
