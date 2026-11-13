import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `What personal data ${site.name} holds, why, for how long and what your choices are — including a section for businesses we contacted about their public contracts and how to opt out.`,
  alternates: { canonical: "/legal/privacy" },
};

const { company, facts } = site;

const summary = [
  "If we emailed your business about its public contracts and you want that to stop: use the [opt-out page](/optout) or reply to the email. That is all it takes. The details are in [section 2](#contacted).",
  "We hold little personal data: account details of the people who use the Service, and, for outreach, the business email address a supplier published in a public contract notice.",
  "Files you upload are your confidential data. They are not used to train AI models and are deleted when you ask.",
  "No advertising cookies. No tracking pixels in our emails. We do not sell personal data.",
];

const sections: LegalSection[] = [
  {
    heading: "Who is responsible for your data",
    id: "controller",
    body: [
      `The controller is ${company.legalName}, ${company.address}, ${company.country}, trading as ${site.name}. The business is run by one person and is based in ${facts.operatorCountry}.`,
      `Contact for privacy matters: ${company.privacyContactEmail}.`,
      `Our representative in the United Kingdom under Article 27 of the UK GDPR is ${company.ukRepresentative}. You can contact the representative about anything in this notice.`,
      `We are registered with the UK Information Commission under reference ${company.icoRegistrationNumber}.`,
      "For the files and content that a customer puts into the Service we act as a processor on that customer’s behalf, under the [data processing agreement](/legal/dpa).",
    ],
  },
  {
    heading: "If we contacted your business about its public contracts",
    id: "contacted",
    body: [
      {
        note: "You can object at any time and we will stop. Use the [opt-out page](/optout) or reply to the email. You do not need to give a reason, and there are no grounds on which we can refuse.",
      },
      { subheading: "Where we got your details" },
      "From contract and award notices that are published on the UK Government’s Find a Tender service and made available under the Open Government Licence. That is a publicly accessible source. A supplier’s contact email appears in a notice because the supplier or the buyer supplied it for the contract. We did not buy a list and we do not obtain details from anywhere else.",
      { subheading: "What we hold" },
      [
        "the business email address published in the notice;",
        "the company name and company number;",
        "the public details of the award: buyer, title, value, dates and the notice reference;",
        "whether we have emailed that address, and whether it replied or opted out.",
      ],
      "We do not store the name of a contact person. If the published address itself identifies a person (for example firstname.surname@company.co.uk), that address is personal data and this section applies to it in full.",
      { subheading: "Why we use it" },
      `For one purpose: to tell the business that a ${site.name} page built from its own public contract record exists, in one introductory email and at most two follow-ups. We email incorporated businesses only, at business addresses.`,
      { subheading: "Our lawful basis" },
      "Legitimate interests (Article 6(1)(f) UK GDPR): our interest in telling businesses about a service that is directly relevant to the public contracts they hold.",
      "How we weighed it: the address was published for procurement purposes, not for marketing, and we have taken that seriously. On the other side, the recipient is acting in a business capacity; the message is about that business’s own contracts and line of work; we send very few messages; we do not profile individuals, publish contact details, or share or sell the address; and every message offers a one-step way to stop. We concluded that the use is one a business contact would reasonably expect and that its impact is low. If you disagree, object and we stop.",
      { subheading: "Who sees it" },
      "Only us, and the email provider that hosts our mailbox ([[OUTREACH_MAILBOX_PROVIDER]]), which acts on our instructions. We do not share or sell it.",
      { subheading: "How long we keep it" },
      [
        `If you do not reply, we delete the address ${facts.outreachRetentionDays} days after the last email we sent.`,
        "If you opt out or object, we keep the address, or only your domain, on a suppression list so that we never contact you again. The list holds nothing else about you and is kept for as long as we send email.",
        "If you reply or become a customer, the address is kept as part of that correspondence or account, as described in the rest of this notice.",
      ],
      { subheading: "Your other rights" },
      "As well as the right to object, you can ask for a copy of what we hold, ask us to correct or delete it, or ask us to restrict how we use it. See [section 10](#your-rights). We make no automated decisions about you.",
      { subheading: "The page about your company" },
      "The public page shows company-level information from the notices. It does not show names, email addresses or phone numbers. If you want the page corrected or removed, write to us through the [contact page](/contact).",
    ],
  },
  {
    heading: "If you use Bidfolio",
    id: "account-data",
    body: [
      "When you create an account or use the Service we collect:",
      [
        "Account data: your name, work email address, a hash of your password, and the identifier from Google if you sign in with Google.",
        "Workspace data: workspace name and logo, members, roles and invitations.",
        "Billing data: plan, subscription status and billing contact email. Card and payment details are collected and held by Paddle, not by us.",
        "Usage data: actions taken in the product, usage counted against plan limits, and the estimated cost of AI processing for your workspace.",
        "Technical data: IP address, browser type and logs needed for security and fault-finding.",
        "Messages you send us.",
      ],
      {
        table: {
          head: ["Why we use it", "Lawful basis"],
          rows: [
            ["To provide the Service and your account", "Contract"],
            ["To bill for paid plans and prevent fraud", "Contract; legitimate interests; legal obligation"],
            ["To secure the Service, enforce limits and fix faults", "Legitimate interests"],
            ["To understand how the product is used and improve it", "Legitimate interests"],
            ["To send service, security and billing emails, digests and deadline reminders you have turned on", "Contract; legitimate interests"],
          ],
        },
      },
      "You can turn digests and reminders off in Settings. We do not sell personal data and we do not use it for advertising.",
    ],
  },
  {
    heading: "Files you upload and your library",
    id: "uploaded-files",
    body: [
      "Tender packs, library documents and company facts are your confidential business information. Where they contain personal data, for example the names of staff in a case study or a CV, your organisation is the controller and we are its processor. The [data processing agreement](/legal/dpa) governs that processing.",
      [
        `They are stored in ${facts.hostingRegion} and can be opened only by members of your workspace.`,
        "Their text is sent to AI model providers to produce your results. It is not used to train AI models, by them or by us.",
        "You can delete them at any time, and we delete everything a workspace holds when the workspace is deleted or when you ask.",
      ],
    ],
  },
  {
    heading: "Public pages built from procurement data",
    id: "public-pages",
    body: [
      "Supplier, buyer and tender pages are built from notices published on Find a Tender. They show information about organisations: names, award titles, values, dates and buyers. We deliberately leave out the names, email addresses and phone numbers of individuals that appear in the source notices.",
      "A sole trader’s business name can be the name of a person. If a page identifies you as an individual and you want it corrected or removed, tell us through the [contact page](/contact) and we will act within five working days.",
    ],
  },
  {
    heading: "Who we share data with",
    id: "processors",
    body: [
      "We share data only with providers that help us run the Service, under contracts that require them to protect it and to act on our instructions:",
      {
        table: {
          head: ["Provider", "What it does for us"],
          rows: [
            ["Vercel Inc.", "Hosts the application and stores uploaded files; routes requests to AI models (Vercel AI Gateway)"],
            ["Neon Inc.", "Hosts the database"],
            ["AI model providers, reached through the Vercel AI Gateway", "Process document text and prompts to produce bid checks, drafts and markings"],
            ["Resend, Inc.", "Delivers service emails such as verification links, digests and reminders"],
            ["Paddle.com Market Ltd", "Sells our plans as merchant of record: payment, invoicing and tax. Paddle is a controller of the payment data it collects"],
            ["[[OUTREACH_MAILBOX_PROVIDER]]", "Hosts the mailbox from which introductory emails are sent"],
          ],
        },
      },
      "[[CONFIRM_ANALYTICS_AND_ERROR_MONITORING: list PostHog and Sentry here if they are switched on in production; remove this line if they are not]]",
      "We also disclose data where the law requires it.",
    ],
  },
  {
    heading: "International transfers",
    id: "transfers",
    body: [
      `We operate from ${facts.operatorCountry}, so personal data is accessed from outside the United Kingdom. Application data and uploaded files are stored in ${facts.hostingRegion}. Some of the providers above process data in other countries, including the United States.`,
      "Where personal data that is protected by the UK GDPR is transferred to a country that the UK has not recognised as adequate, we rely on an appropriate safeguard:",
      [
        `access from ${facts.operatorCountry}: [[TRANSFER_MECHANISM_UK_TO_OPERATOR_COUNTRY]];`,
        "providers in the United States and elsewhere: [[TRANSFER_MECHANISM_PROCESSORS: for example the UK International Data Transfer Addendum to the EU Standard Contractual Clauses, or the UK Extension to the EU–US Data Privacy Framework where the provider is certified]].",
      ],
      "You can ask us for a copy of the safeguards that apply to your data.",
    ],
  },
  {
    heading: "Cookies, tracking and email",
    id: "cookies",
    body: [
      [
        "We use strictly necessary cookies only: to keep you signed in and to protect forms against forgery.",
        "We do not use advertising cookies and we do not take part in advertising networks.",
        "Our emails contain no tracking pixels. We do not know whether you opened an email.",
        "A link in an introductory email carries a short code so that we can count how many recipients visited their page. It sets no cookie.",
      ],
      "[[CONFIRM_PRODUCT_ANALYTICS: if product analytics is switched on, describe the identifier it stores and how to refuse it; otherwise state that no analytics cookies are used]]",
    ],
  },
  {
    heading: "How long we keep data",
    id: "retention",
    body: [
      {
        table: {
          head: ["Data", "Kept for"],
          rows: [
            ["Account and workspace data", "The life of the account, then deleted within 30 days of closure"],
            ["Uploaded files, library and bids", "Until you delete them or the workspace is deleted"],
            ["Billing records", "As long as tax and accounting law requires; invoices are held by Paddle"],
            ["Outreach contact that never replied", `Deleted ${facts.outreachRetentionDays} days after the last email`],
            ["Opt-outs and objections", "Suppression list, kept for as long as we send email"],
            ["Record of which notices we emailed about", "24 months, as evidence that we followed this notice"],
            ["Security and error logs", "Up to 90 days, longer only to investigate an incident"],
          ],
        },
      },
    ],
  },
  {
    heading: "Your rights",
    id: "your-rights",
    body: [
      "Under UK data protection law you have the right to:",
      [
        "object to our use of your data for direct marketing, at any time: we will stop;",
        "ask for a copy of the personal data we hold about you;",
        "ask us to correct data that is wrong, or to delete data;",
        "ask us to restrict how we use your data, or object to a use that relies on legitimate interests;",
        "receive data you gave us in a portable format, where the law provides for it.",
      ],
      `To use any of these rights, write to ${company.privacyContactEmail} or to our UK representative. We reply within one month. It costs nothing.`,
    ],
  },
  {
    heading: "How to complain",
    id: "complaints",
    body: [
      `If you think we have handled your personal data wrongly, tell us first: write to ${company.privacyContactEmail} or use the [contact page](/contact), and say that it is a data protection complaint.`,
      [
        "We acknowledge every complaint within 30 days.",
        "We look into it and tell you the outcome without undue delay.",
      ],
      "You also have the right to complain to the UK Information Commission (the ICO) at [ico.org.uk/make-a-complaint](https://ico.org.uk/make-a-complaint/) or on 0303 123 1113. You can do that at any time, though the ICO will usually expect you to have raised the matter with us first.",
    ],
  },
  {
    heading: "Security",
    id: "security",
    body: [
      "Data is encrypted in transit. Workspaces are separated from one another, access inside a workspace follows roles, and uploaded files are served only to signed-in members of the workspace. Passwords are stored only as salted hashes. Sign-in attempts are rate-limited.",
      "No system is perfectly secure. If a breach of personal data is likely to put people at risk, we tell the people affected and the regulator without undue delay.",
    ],
  },
  {
    heading: "Changes to this notice",
    id: "changes",
    body: ["We post changes here and change the date at the top. We tell workspace owners by email about changes that matter."],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy notice"
      intro={`This notice explains what personal data ${site.name} holds, where it comes from, why we use it, how long we keep it and what your choices are. It covers two groups of people: business contacts whose details appear in public contract notices, and the people who use the Service.`}
      summary={summary}
      sections={sections}
    />
  );
}
