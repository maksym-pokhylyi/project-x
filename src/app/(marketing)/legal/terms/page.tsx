import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { BID_PASS } from "@/config/plan-display";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms on which ${site.name} is provided: plans and billing through Paddle, AI-assisted analysis without guarantee of outcomes, your responsibility for your submissions, and how your files are treated.`,
  alternates: { canonical: "/legal/terms" },
};

const { company, facts, legal } = site;

const summary = [
  `${site.name} is software that helps you find public tenders and prepare bids. It is not a government service and it does not submit bids for you.`,
  "The analysis and drafts are AI-assisted. They can be wrong or incomplete, and we do not promise any outcome. You check them against the tender documents and you remain responsible for what you submit.",
  "Your tender packs and library are your confidential data. We do not use them to train AI models and we delete them when you ask.",
  "Paid plans are sold through Paddle, our merchant of record. You can pause or cancel at any time; refunds follow the [refund policy](/legal/refunds).",
];

const sections: LegalSection[] = [
  {
    heading: "Who we are and who these terms are for",
    id: "who-we-are",
    body: [
      `${site.name} (the “Service”) is operated by ${company.legalName}, ${company.address}, registration number ${company.registrationNumber} (“we”, “us”). These terms are a contract between us and the business that creates an account (“you”).`,
      "The Service is for business use. By creating an account you confirm that you are at least 18, that you are acting for a business and not as a consumer, and that you may accept these terms on behalf of that business.",
      "These terms sit alongside the [privacy notice](/legal/privacy), the [refund policy](/legal/refunds), the [acceptable use policy](/legal/acceptable-use) and, where we process personal data for you, the [data processing agreement](/legal/dpa).",
    ],
  },
  {
    heading: "What the Service does, and what it does not",
    id: "the-service",
    body: [
      "The Service has two parts:",
      [
        "Radar: public pages and a private radar built from open UK procurement data. They show a supplier’s published contract awards, open tenders that resemble them, contracts that end soon and the buyers that award in a trade.",
        "Bid Desk: you upload a tender pack and get a cited bid check (requirements, key dates and scored questions quoted from the documents, with file and page), a scored-question matrix, first drafts written from your own evidence, an evaluator-style marking of each answer and an export to Word.",
      ],
      `${site.name} is an independent, private service. It is not part of, affiliated with, or endorsed by the UK Government, the Cabinet Office or the Find a Tender service. It does not submit bids to buyers or procurement portals, it does not complete pricing schedules and it does not give legal or procurement advice.`,
    ],
  },
  {
    heading: "Accounts and workspaces",
    id: "accounts",
    body: [
      "You are responsible for what happens in your account and workspaces, for keeping sign-in details confidential and for the people you invite. Workspace owners and admins decide who has access and with which role.",
      "Give accurate information and keep your contact email current: we use it for service, billing and security notices.",
      "If you claim a supplier page, you confirm that you are authorised to act for that company. We may ask for evidence and may remove a claim that appears to be wrong.",
    ],
  },
  {
    heading: "Plans, the Bid Pass, trials and billing",
    id: "billing",
    body: [
      "The Service is offered on a free plan and on paid plans described on the [pricing page](/pricing). Each plan has limits, such as the number of full bids a month and the number of seats. Limits that apply to you are shown in Settings.",
      { subheading: "Paddle is the merchant of record" },
      "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the merchant of record for all our orders. Paddle provides all customer service inquiries relating to payment and handles returns. Paddle takes the payment, issues the invoice and accounts for VAT and other sales taxes. Paddle’s buyer terms apply to the purchase in addition to these terms.",
      { subheading: "Subscriptions" },
      [
        "Paid plans are billed in advance for each monthly or annual period and renew automatically until you cancel. Annual plans cost ten monthly payments.",
        "We send a reminder by email at least 7 days before an annual plan renews.",
        "You can pause a subscription for one to three months, or cancel it, from Settings. A cancellation takes effect at the end of the period you have paid for; the workspace then returns to the free plan and your data stays.",
        "Full bids included in a plan that you do not use roll over for one month and then expire.",
        `Bid Desk can be started with a ${facts.trialDays}-day trial. A payment card is required. The first payment is taken when the trial ends unless you cancel before then.`,
        "If a payment fails, paid features stay available for 7 days while you update the payment method. After that the workspace is limited to the free plan until payment succeeds. Your data stays.",
      ],
      { subheading: `${BID_PASS.name}` },
      `A ${BID_PASS.name} is a single payment of ${BID_PASS.price} for one full bid. It does not renew. [[CONFIRM_BID_PASS_EXPIRY: state how long an unused pass remains valid, for example 12 months]]`,
      { subheading: "Price changes" },
      "We may change prices. A change does not affect a period you have already paid for. We tell workspace owners by email at least 30 days before a new price applies to a renewal, and you can cancel before it does.",
      `Refunds are described in the [refund policy](/legal/refunds). In short: ${legal.refundWindowDays} days from your first payment.`,
    ],
  },
  {
    heading: "AI-assisted analysis: no guarantee of outcomes",
    id: "ai-analysis",
    body: [
      "Bid checks, question lists, drafts, markings and match reasons are produced with the help of third-party AI models. They are a starting point for your own work, not a finished product and not professional advice.",
      "AI output can be inaccurate, incomplete or out of date. In particular, we do not promise that:",
      [
        "a bid check finds every requirement, date or scored question in a tender pack, or reads each one correctly;",
        "a status such as “Met” or “Gap” is right for your company;",
        "a draft is accurate, complete or compliant with the buyer’s instructions;",
        "an evaluator-style marking matches the score a buyer will give;",
        "using the Service will lead to a bid being accepted, shortlisted or won.",
      ],
      "To help you check the output, each finding in a bid check shows the quote it relies on with its file and page, and findings whose quote could not be matched to the source text are marked “Verify in documents”. You must check the output against the tender documents before you rely on it.",
      "Use of AI features is subject to fair-use limits that depend on your plan.",
    ],
  },
  {
    heading: "Your responsibility for your submissions",
    id: "your-submissions",
    body: [
      "You decide whether to bid and what to submit. You remain solely responsible for every bid, answer and statement you send to a buyer, including:",
      [
        "the accuracy and truth of everything in it, including text that the Service drafted;",
        "having the evidence, accreditations, insurance and experience that you claim;",
        "following the buyer’s instructions, including any rules on the use of AI and any request to disclose it;",
        "meeting word limits, formats and deadlines, and submitting through the buyer’s own channel.",
      ],
      "Where a draft shows “Evidence needed”, the Service did not find support for a statement in your library. Do not submit such a statement unless you can support it.",
    ],
  },
  {
    heading: "Your files and your content",
    id: "your-content",
    body: [
      "“Customer Content” means what you put into the Service: tender packs, library documents, company facts, notes, and the drafts and edits you make.",
      [
        "Customer Content is yours. You give us only the rights we need to host, process and display it in order to provide and support the Service for you.",
        "Customer Content is your confidential information. We do not disclose it to buyers, to other customers or to anyone else, except to the service providers that help us run the Service, under contracts that protect it.",
        "We do not use Customer Content to train AI models, and we do not allow our AI model providers to do so. They process it only to return a result to you.",
        `Customer Content is stored in ${facts.hostingRegion}.`,
        "You can delete a bid, a file or a library document at any time. When you delete a workspace, or ask us to, we delete its Customer Content from live systems without undue delay and from backups within [[CONFIRM_BACKUP_RETENTION_DAYS]] days, except where the law requires us to keep something.",
      ],
      "You confirm that you are entitled to upload what you upload. Some tender packs are issued under confidentiality terms: check that those terms allow you to use a software service to prepare your bid.",
      "As between you and us, the output the Service produces from your Customer Content is yours to use.",
      "Where Customer Content includes personal data, for example names in a case study or a staff list, we process it on your behalf under the [data processing agreement](/legal/dpa).",
    ],
  },
  {
    heading: "Public procurement data",
    id: "public-data",
    body: [
      "Notice and award information in the Service comes from the UK Government’s Find a Tender service. It contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).",
      "We reproduce and summarise that information as published. We do not verify it, and we do not promise that it is accurate, complete or current: buyers correct and withdraw notices, values are sometimes estimates, and some procurements are not published on Find a Tender at all. Always confirm a deadline or requirement in the buyer’s own documents.",
      "If information about your organisation is wrong, or you want a page removed, write to us through the [contact page](/contact). We act on correction and removal requests within five working days.",
    ],
  },
  {
    heading: "Acceptable use",
    id: "acceptable-use",
    body: [
      "You must follow the [acceptable use policy](/legal/acceptable-use). In short: use the Service lawfully and honestly, do not try to reach other customers’ data, do not copy our pages in bulk, and do not use the Service to fabricate evidence for a bid.",
      "We may suspend access that puts the Service or other customers at risk, and we will tell you why unless the law prevents it.",
    ],
  },
  {
    heading: "Intellectual property",
    id: "intellectual-property",
    body: [
      "The Service, including its software, design, text and the way the data is organised, belongs to us and our licensors. For as long as you have an account we give you a non-exclusive, non-transferable right to use it for your own business.",
      "If you send us feedback, we may use it without owing you anything.",
    ],
  },
  {
    heading: "Availability, support and changes to the Service",
    id: "availability",
    body: [
      "We work to keep the Service available and secure, but we do not promise that it will be uninterrupted or free of errors. Processing a tender pack depends on third-party AI services and can occasionally fail or take longer than usual; when it fails, we show what failed and you can try again.",
      "We may change features. If a change materially reduces what a paid plan includes, we will give reasonable notice and you may cancel.",
      `Support is by email at ${site.supportEmail}.`,
    ],
  },
  {
    heading: "Warranties and liability",
    id: "liability",
    body: [
      "Except as set out in these terms, the Service is provided “as is” and, to the extent the law allows, we exclude all implied warranties and conditions.",
      "To the extent the law allows:",
      [
        "we are not liable for loss of profit, revenue, business, contracts or opportunity, including a bid that is rejected, disqualified, scored low or lost, or for any indirect or consequential loss;",
        "our total liability arising out of or in connection with these terms in any 12-month period is limited to the greater of the fees you paid for the Service in that period and £100.",
      ],
      "Nothing in these terms limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited or excluded by law.",
    ],
  },
  {
    heading: "Suspension and ending the contract",
    id: "termination",
    body: [
      "These terms apply for as long as you have an account. You may stop using the Service and close your account at any time.",
      "We may suspend or close an account that materially breaches these terms and does not put the breach right within 14 days of our notice, or immediately where the breach is serious, unlawful or puts others at risk.",
      "When an account is closed we delete Customer Content as described in section 7. Sections that by their nature should continue, such as liability and governing law, continue to apply.",
    ],
  },
  {
    heading: "Governing law",
    id: "governing-law",
    body: [
      `These terms are governed by the laws of ${company.governingLaw}, and the courts of ${company.governingLaw} have exclusive jurisdiction, without affecting any mandatory rights you have under the law of your own country.`,
    ],
  },
  {
    heading: "Changes to these terms, and how to reach us",
    id: "changes",
    body: [
      "We may update these terms. We will tell workspace owners by email at least 14 days before a material change takes effect. If you keep using the Service after that date, you accept the updated terms.",
      `Questions: ${site.supportEmail}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro={`These terms govern your use of ${site.name}. They are written to be read: the summary below is not a substitute for the sections that follow, but it tells you what matters most.`}
      summary={summary}
      sections={sections}
    />
  );
}
