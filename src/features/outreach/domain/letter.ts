import { possessive } from "./names";

/**
 * The letters of docs/gtm/02-outreach-kit.md, as typed templates (PURE).
 *
 * THE WORDING IS NOT FREE TEXT. Sections 4–7 of the kit were written against the legal
 * research (P2 §7) and the compliance pack (docs/gtm/07-compliance-pack.md §2 and §5):
 *  - the first paragraph says why this company is being written to (its own notice);
 *  - the signature says who is writing (PECR reg. 23(a)) and how to stop it (reg. 23(b),
 *    UK GDPR Art. 21(4): "presented clearly and separately");
 *  - an address that identifies a person gets variant B and the "Where we got your
 *    details" paragraph (Art. 14);
 *  - the last paragraph is the OGL attribution and the independence statement.
 * Change a sentence here only together with those documents.
 *
 * Plain text only: one link to the company's page, the opt-out link and the privacy notice.
 * No HTML, no images, no tracking pixel, no link shortener. The app never sends these
 * letters — the founder does, from his own mailbox.
 */

export type LetterKind = "first" | "reminder_1" | "reminder_2";

export type LetterFields = {
  /** Registered name, in ordinary case. */
  company: string;
  /** The same without its legal suffix, for the second mention. */
  companyShort: string;
  /** Contract title as quoted (see quotedTitle). */
  awardTitle: string;
  buyer: string;
  /** "£370,000", "£175,000 including VAT", or null: the letter then says nothing about value. */
  value: string | null;
  /** "3 November 2026" */
  noticeDate: string;
};

export type LetterSender = {
  /** Closes the letter. */
  firstName: string;
  /** The person behind the brand; first line of the signature. */
  fullName: string;
  /** Registered name, given in brackets when it differs from the full name. */
  legalName: string;
  /** What the operator is: "an independent sole trader registered in Ukraine". */
  description: string;
  postalAddress: string;
  contactEmail: string;
  /** UK GDPR Art. 27 representative. Null until one is appointed: the letter then names none. */
  ukRepresentative: string | null;
  icoNumber: string | null;
};

export type LetterInput = {
  templateKey: string;
  subjectVariant: string;
  kind: LetterKind;
  /** The address identifies a person: variant B and the Art. 14 paragraph. */
  personalData: boolean;
  fields: LetterFields;
  links: { page: string; optout: string; privacy: string };
  sender: LetterSender;
  brand: { name: string; domain: string };
  /** Days after which a named address is deleted when there is no reply; stated in the letter, enforced by retention. */
  namedRetentionDays: number;
};

export type RenderedLetter = {
  subject: string;
  body: string;
  /** Which text was used, for the send log: "A" generic mailbox, "B" named address, "R1"/"R2" reminders. */
  variant: "A" | "B" | "R1" | "R2";
};

type Context = LetterFields & { pageUrl: string; brand: string; senderFirstName: string };
type Subject = { label: string; render: (context: Context) => string };

export type LetterTemplate = {
  label: string;
  subjects: Record<string, Subject>;
  /** Paragraphs of the first letter. */
  first: { generic: (context: Context) => string[]; named: (context: Context) => string[] };
  reminder1: (context: Context) => string[];
  reminder2: (context: Context) => string[];
};

/** "(£175,000)" inside a sentence, or nothing. */
const inBrackets = (value: string | null) => (value ? ` (${value})` : "");

export const LETTER_TEMPLATES: Record<string, LetterTemplate> = {
  /** Kit §4 subjects 1–4, §5 variants A and B, §6 reminders. */
  award_page_v1: {
    label: "Your award and your page (kit variants A and B)",
    subjects: {
      s1: { label: "1 · [Company]: your public contract awards on one page", render: (c) => `${c.company}: your public contract awards on one page (from ${c.brand})` },
      s2: { label: "2 · A page about [Company]'s public contracts", render: (c) => `A page about ${possessive(c.company)} public contracts – ${c.brand}` },
      s3: { label: "3 · [Company] and [Buyer]: your award, and similar open tenders", render: (c) => `${c.company} and ${c.buyer}: your award, and similar open tenders (${c.brand})` },
      s4: { label: "4 · Open tenders like the [Buyer] contract", render: (c) => `Open tenders like the ${c.buyer} contract – a free page from ${c.brand}` },
    },
    first: {
      generic: (c) => [
        "Hello,",
        `${c.company} is named as the supplier on "${c.awardTitle}" for ${c.buyer}${inBrackets(c.value)}, in a contract notice published on Find a Tender on ${c.noticeDate}.`,
        `I run ${c.brand}, a paid software service for small firms that bid for public contracts. I have put ${possessive(c.companyShort)} published awards, similar open tenders and the buyers who award this kind of work without a tender on one page – free to read, no sign-in:`,
        c.pageUrl,
        `Is it useful to whoever handles tenders at ${c.companyShort}? If not, a one-word reply is enough and I will not write again.`,
        c.senderFirstName,
      ],
      named: (c) => [
        "Hello,",
        `I am writing to this address because the public notice for "${c.awardTitle}" (${c.buyer}${c.value ? `, ${c.value}` : ""}; Find a Tender, ${c.noticeDate}) gives it as the supplier contact for ${c.company}.`,
        `I run ${c.brand}, a paid software service for small firms that bid for public contracts. I have put ${possessive(c.companyShort)} published awards, similar open tenders and the buyers who award this kind of work without a tender on one page – free to read, no sign-in:`,
        c.pageUrl,
        'That notice is my only source for your address. I use it for this message and at most two reminders. You can object at any time: reply "stop" and I will not write again.',
        c.senderFirstName,
      ],
    },
    reminder1: (c) => [
      "Hello again,",
      `A short reminder about the page I built from ${possessive(c.company)} published contract awards: ${c.pageUrl}`,
      "It shows similar open tenders and which buyers award this kind of work without a tender. It is free and needs no sign-in. If someone else looks after tenders, please pass it on.",
      c.senderFirstName,
    ],
    reminder2: (c) => [
      "Hello,",
      `This is my last note. ${possessive(c.company)} page stays free at ${c.pageUrl} and updates as new notices are published.`,
      "If a tender pack lands on your desk, the first check of it is free: what would get a bid rejected, quoted from the buyer's documents with file and page. I will not email again unless you reply.",
      c.senderFirstName,
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(LETTER_TEMPLATES);

export function subjectVariants(templateKey: string): Array<{ key: string; label: string }> {
  const template = LETTER_TEMPLATES[templateKey];
  return template ? Object.entries(template.subjects).map(([key, subject]) => ({ key, label: subject.label })) : [];
}

export function isKnownTemplate(templateKey: string, subjectVariant: string): boolean {
  return Boolean(LETTER_TEMPLATES[templateKey]?.subjects[subjectVariant]);
}

const oneLine = (text: string) => text.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/**
 * The signature of kit §7. Blocks, in order: who is writing (A), how to stop it (B), the
 * privacy notice (C), where the address came from (D — only for an address that identifies
 * a person, and only in the first letter), independence and attribution (E).
 */
export function renderSignature(input: Pick<LetterInput, "kind" | "personalData" | "fields" | "links" | "sender" | "brand" | "namedRetentionDays">): string {
  const { sender, brand, fields, links } = input;
  const registered = sender.legalName && sender.legalName !== sender.fullName ? ` (legal name ${sender.legalName})` : "";
  const identity = [`${brand.name} is operated by ${sender.fullName}, ${sender.description}${registered}. ${sentence(sender.postalAddress)} Contact: ${sender.contactEmail}.`];
  if (sender.ukRepresentative) identity.push(`UK data-protection representative: ${sentence(sender.ukRepresentative)}`);
  if (sender.icoNumber) identity.push(`ICO registration number: ${sender.icoNumber}`);

  const blocks = [
    `--\n${sender.fullName}, ${brand.name} – ${brand.domain}`,
    identity.join("\n"),
    `To stop these emails, reply "stop" or use this link: ${links.optout}\nYou have the right to object to marketing from us at any time. We will not contact ${fields.company} again.`,
    `Privacy notice: ${links.privacy}`,
  ];
  if (input.personalData && input.kind === "first") {
    blocks.push(
      `Where we got your details: this address appears as the supplier contact in the public contract notice mentioned above (Find a Tender, published under the Open Government Licence v3.0). We use it only to send this message and at most two follow-ups, on the basis of our legitimate interest in telling suppliers about our service, and delete it after ${input.namedRetentionDays} days if you do not reply. Your rights and how to complain are in the privacy notice linked above.`,
    );
  }
  blocks.push(
    `${brand.name} is an independent commercial service. It is not affiliated with the UK Government, the Cabinet Office or Find a Tender. Contains public sector information licensed under the Open Government Licence v3.0.`,
  );
  return blocks.join("\n\n");
}

/** Subject and plain-text body (letter + signature) for one prospect. Throws on a template that does not exist. */
export function renderLetter(input: LetterInput): RenderedLetter {
  const template = LETTER_TEMPLATES[input.templateKey];
  const subject = template?.subjects[input.subjectVariant];
  if (!template || !subject) throw new Error(`Unknown letter template "${input.templateKey}/${input.subjectVariant}"`);

  const fields: LetterFields = {
    company: oneLine(input.fields.company),
    companyShort: oneLine(input.fields.companyShort),
    awardTitle: oneLine(input.fields.awardTitle),
    buyer: oneLine(input.fields.buyer),
    value: input.fields.value ? oneLine(input.fields.value) : null,
    noticeDate: oneLine(input.fields.noticeDate),
  };
  const context: Context = { ...fields, pageUrl: input.links.page, brand: input.brand.name, senderFirstName: input.sender.firstName };

  let paragraphs: string[];
  let variant: RenderedLetter["variant"];
  if (input.kind === "reminder_1") {
    paragraphs = template.reminder1(context);
    variant = "R1";
  } else if (input.kind === "reminder_2") {
    paragraphs = template.reminder2(context);
    variant = "R2";
  } else if (input.personalData) {
    paragraphs = template.first.named(context);
    variant = "B";
  } else {
    paragraphs = template.first.generic(context);
    variant = "A";
  }

  const signature = renderSignature({ ...input, fields });
  return { subject: oneLine(subject.render(context)), body: `${paragraphs.join("\n\n")}\n\n${signature}\n`, variant };
}
