import { describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "@/config/retention";
import { site } from "@/config/site";
import { operatorFooterLine, outreachSender, senderProblems, ukRepresentativeAppointed } from "@/features/outreach/config";
import { CSV_BOM, csvField, guardCell, parseCsv, toCsv } from "@/features/outreach/domain/csv";
import { describeShare, readFunnel, thresholdsFor, type FunnelCounts } from "@/features/outreach/domain/funnel";
import { LETTER_TEMPLATES, renderLetter, subjectVariants, type LetterInput } from "@/features/outreach/domain/letter";
import { displayName, letterValue, longDate, possessive, quotedTitle, shortCompanyName } from "@/features/outreach/domain/names";
import { DEFAULT_SEGMENT, describeSegment, parsePounds, segmentFromParams, segmentSchema, segmentToParams } from "@/features/outreach/domain/segment";
import { selectProspects, type Candidate, type CandidateContact, type SelectionContext } from "@/features/outreach/domain/select";
import { buildSuppressionIndex, domainAndParents, extractEmails, normaliseEmail, normaliseTarget } from "@/features/outreach/domain/suppression";

/**
 * The pure parts of the outreach tooling. Every address in this file is fictional and on a
 * reserved `.example` domain.
 */
const NOW = new Date("2026-11-13T12:00:00Z");

describe("names and figures as a letter writes them", () => {
  it("sets a name published in capitals in ordinary case and leaves mixed case alone", () => {
    expect(displayName("HINCKLEY PLUMBING AND HEATING SERVICES LIMITED")).toBe("Hinckley Plumbing and Heating Services Limited");
    expect(displayName("HOME SUPPORT MATTERS CIC")).toBe("Home Support Matters CIC");
    expect(displayName("ABC CLEANING SERVICES LTD")).toBe("ABC Cleaning Services Ltd");
    expect(displayName("J & S BUILDERS LIMITED")).toBe("J & S Builders Limited");
    expect(displayName("O'BRIEN MCDONALD (UK) LLP")).toBe("O'Brien McDonald (UK) LLP");
    expect(displayName("STOKE-ON-TRENT CITY COUNCIL")).toBe("Stoke-on-Trent City Council");
    expect(displayName("THE BIG RED BUS CO LTD")).toBe("The Big Red Bus Co Ltd");
    expect(displayName("NHS ENGLAND")).toBe("NHS England");
    expect(displayName("ST HELENS BOROUGH COUNCIL")).toBe("St Helens Borough Council");
    expect(displayName("A1 24/7 SECURITY LTD")).toBe("A1 24/7 Security Ltd");
    // A short given name is a name; a short run of initials is not.
    expect(displayName("IAN WILLIAMS LIMITED")).toBe("Ian Williams Limited");
    expect(displayName("TOM JONES & SONS LTD")).toBe("Tom Jones & Sons Ltd");
    expect(displayName("PJC ELECTRICAL LIMITED")).toBe("PJC Electrical Limited");
    expect(displayName("JCB FINANCE LTD T/A JCB")).toBe("JCB Finance Ltd T/A JCB");
    expect(displayName("DE MONTFORT FINE ART LTD")).toBe("De Montfort Fine Art Ltd");
    // Already mixed case: exactly as published (only whitespace is tidied).
    expect(displayName("  eXPD8  Analytics Ltd ")).toBe("eXPD8 Analytics Ltd");
    expect(displayName("")).toBe("");
  });

  it("drops the legal suffix for the second mention and forms the possessive", () => {
    expect(shortCompanyName("Hinckley Plumbing and Heating Services Limited")).toBe("Hinckley Plumbing and Heating Services");
    expect(shortCompanyName("Home Support Matters CIC")).toBe("Home Support Matters");
    expect(shortCompanyName("Softcat plc")).toBe("Softcat");
    expect(shortCompanyName("Gibbs Laidler LLP")).toBe("Gibbs Laidler");
    expect(shortCompanyName("Acme Grounds, Ltd.")).toBe("Acme Grounds");
    expect(shortCompanyName("Limited")).toBe("Limited");
    expect(possessive("Hinckley Plumbing")).toBe("Hinckley Plumbing's");
    expect(possessive("John Flowers")).toBe("John Flowers'");
  });

  it("quotes a contract title on one line and cuts it at twelve words", () => {
    expect(quotedTitle('  Larwood House -\n "Pre-Packaged" Gas Boiler Plant Room ')).toBe("Larwood House - 'Pre-Packaged' Gas Boiler Plant Room");
    const long = "Provision of grounds maintenance, grass cutting and arboricultural services for parks, cemeteries and open spaces across the district 2026 to 2029";
    expect(quotedTitle(long)).toBe("Provision of grounds maintenance, grass cutting and arboricultural services for parks, cemeteries…");
    expect(quotedTitle(long).split(" ")).toHaveLength(12);
    // Never stops on a word that leads nowhere.
    expect(quotedTitle("Supply and delivery of fresh fruit and vegetables to schools in the borough of Example")).toBe("Supply and delivery of fresh fruit and vegetables to schools…");
  });

  it("states a value only when the figure is the supplier's own", () => {
    const own = { valueAmount: 370_000, valueGross: 444_000, currency: "GBP", valueShared: false, isFramework: false };
    expect(letterValue(own)).toBe("£370,000");
    // Only the gross figure was published.
    expect(letterValue({ ...own, valueAmount: 175_000, valueGross: 175_000 })).toBe("£175,000 including VAT");
    expect(letterValue({ ...own, valueAmount: 52_459.55, valueGross: 52_459.55 })).toBe("£52,459.55 including VAT");
    expect(letterValue({ ...own, valueGross: null })).toBe("£370,000");
    expect(letterValue({ ...own, valueShared: true })).toBeNull();
    expect(letterValue({ ...own, isFramework: true })).toBeNull();
    expect(letterValue({ ...own, valueAmount: null })).toBeNull();
    expect(letterValue({ ...own, valueAmount: 999 })).toBeNull();
    expect(letterValue({ ...own, valueAmount: 250_000_000 })).toBeNull();
    expect(longDate("2026-11-03T09:30:00Z")).toBe("3 November 2026");
  });
});

const letterInput = (overrides: Partial<LetterInput> = {}): LetterInput => ({
  templateKey: "award_page_v1",
  subjectVariant: "s1",
  kind: "first",
  personalData: false,
  fields: {
    company: "Acme Grounds Ltd",
    companyShort: "Acme Grounds",
    awardTitle: "Grounds Maintenance Services",
    buyer: "Leeds City Council",
    value: "£120,000",
    noticeDate: "8 November 2026",
  },
  links: { page: "https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111?r=Ab3dE6gH9k", optout: "https://bidfolio.co.uk/optout?c=Ab3dE6gH9k", privacy: "https://bidfolio.co.uk/legal/privacy#contacted" },
  sender: {
    firstName: "Fay",
    fullName: "Fay Founder",
    legalName: "FOP Founder Fay Example",
    description: "an independent sole trader registered in Ukraine",
    postalAddress: "1 Example Street, Poltava, 36000, Ukraine",
    contactEmail: "fay@getbidfolio.example",
    ukRepresentative: "Example Rep Ltd, 2 Sample Road, London",
    icoNumber: "ZB0000000",
  },
  brand: { name: "Bidfolio", domain: "bidfolio.co.uk" },
  namedRetentionDays: 90,
  ...overrides,
});

describe("letters (docs/gtm/02-outreach-kit.md)", () => {
  it("variant A: says why this company, what this is, one link, and how to stop it", () => {
    const letter = renderLetter(letterInput());
    expect(letter.variant).toBe("A");
    expect(letter.subject).toBe("Acme Grounds Ltd: your public contract awards on one page (from Bidfolio)");
    const paragraphs = letter.body.split("\n\n");
    expect(paragraphs.slice(0, 6)).toEqual([
      "Hello,",
      'Acme Grounds Ltd is named as the supplier on "Grounds Maintenance Services" for Leeds City Council (£120,000), in a contract notice published on Find a Tender on 8 November 2026.',
      "I run Bidfolio, a paid software service for small firms that bid for public contracts. I have put Acme Grounds' published awards, similar open tenders and the buyers who award this kind of work without a tender on one page – free to read, no sign-in:",
      "https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111?r=Ab3dE6gH9k",
      "Is it useful to whoever handles tenders at Acme Grounds? If not, a one-word reply is enough and I will not write again.",
      "Fay",
    ]);
  });

  it("carries every line the law asks for, each in its own paragraph", () => {
    const { body } = renderLetter(letterInput());
    const paragraphs = body.trim().split("\n\n");
    // Who is writing (PECR reg. 23(a)): the real person behind the brand, where they are, how to reach them.
    expect(paragraphs).toContain("--\nFay Founder, Bidfolio – bidfolio.co.uk");
    expect(paragraphs).toContain(
      "Bidfolio is operated by Fay Founder, an independent sole trader registered in Ukraine (legal name FOP Founder Fay Example). 1 Example Street, Poltava, 36000, Ukraine. Contact: fay@getbidfolio.example.\n" +
        "UK data-protection representative: Example Rep Ltd, 2 Sample Road, London.\n" +
        "ICO registration number: ZB0000000",
    );
    // How to stop it (reg. 23(b), Art. 21(4)): clearly and separately.
    expect(paragraphs).toContain(
      'To stop these emails, reply "stop" or use this link: https://bidfolio.co.uk/optout?c=Ab3dE6gH9k\nYou have the right to object to marketing from us at any time. We will not contact Acme Grounds Ltd again.',
    );
    expect(paragraphs).toContain("Privacy notice: https://bidfolio.co.uk/legal/privacy#contacted");
    // Independence and OGL attribution.
    expect(paragraphs.at(-1)).toBe(
      "Bidfolio is an independent commercial service. It is not affiliated with the UK Government, the Cabinet Office or Find a Tender. Contains public sector information licensed under the Open Government Licence v3.0.",
    );
    // A generic mailbox is not personal data: no Art. 14 paragraph.
    expect(body).not.toContain("Where we got your details");
  });

  it("variant B for an address that identifies a person: the Art. 14 wording", () => {
    const letter = renderLetter(letterInput({ personalData: true }));
    expect(letter.variant).toBe("B");
    expect(letter.body).toContain(
      'I am writing to this address because the public notice for "Grounds Maintenance Services" (Leeds City Council, £120,000; Find a Tender, 8 November 2026) gives it as the supplier contact for Acme Grounds Ltd.',
    );
    expect(letter.body).toContain('That notice is my only source for your address. I use it for this message and at most two reminders. You can object at any time: reply "stop" and I will not write again.');
    expect(letter.body).toContain(
      "Where we got your details: this address appears as the supplier contact in the public contract notice mentioned above (Find a Tender, published under the Open Government Licence v3.0). We use it only to send this message and at most two follow-ups, on the basis of our legitimate interest in telling suppliers about our service, and delete it after 90 days if you do not reply. Your rights and how to complain are in the privacy notice linked above.",
    );
    // No greeting by name: the contact's name is never stored.
    expect(letter.body.startsWith("Hello,\n\n")).toBe(true);
  });

  it("says nothing about value when there is no figure to state", () => {
    const generic = renderLetter(letterInput({ fields: { ...letterInput().fields, value: null } }));
    expect(generic.body).toContain('for Leeds City Council, in a contract notice published');
    expect(generic.body).not.toContain("()");
    const named = renderLetter(letterInput({ personalData: true, fields: { ...letterInput().fields, value: null } }));
    expect(named.body).toContain("(Leeds City Council; Find a Tender, 8 November 2026)");
  });

  it("offers the four subject lines of the kit", () => {
    expect(subjectVariants("award_page_v1").map((variant) => variant.key)).toEqual(["s1", "s2", "s3", "s4"]);
    const subject = (variant: string) => renderLetter(letterInput({ subjectVariant: variant })).subject;
    expect(subject("s2")).toBe("A page about Acme Grounds Ltd's public contracts – Bidfolio");
    expect(subject("s3")).toBe("Acme Grounds Ltd and Leeds City Council: your award, and similar open tenders (Bidfolio)");
    expect(subject("s4")).toBe("Open tenders like the Leeds City Council contract – a free page from Bidfolio");
    // Honest subjects: nothing that reads as a reply or as an official notice.
    for (const variant of ["s1", "s2", "s3", "s4"]) expect(subject(variant)).not.toMatch(/^(re|fwd?):|notice|notification|official|action required/i);
    expect(() => renderLetter(letterInput({ subjectVariant: "s9" }))).toThrow(/Unknown letter template/);
  });

  it("reminders keep the identity and opt-out blocks and drop the Art. 14 paragraph", () => {
    const first = renderLetter(letterInput({ kind: "reminder_1", personalData: true }));
    expect(first.variant).toBe("R1");
    expect(first.body).toContain("A short reminder about the page I built from Acme Grounds Ltd's published contract awards: https://bidfolio.co.uk/suppliers/acme-grounds-ltd-01111111?r=Ab3dE6gH9k");
    expect(first.body).toContain("To stop these emails");
    expect(first.body).not.toContain("Where we got your details");
    const last = renderLetter(letterInput({ kind: "reminder_2" }));
    expect(last.variant).toBe("R2");
    expect(last.body).toContain("This is my last note.");
    expect(last.body).toContain("I will not email again unless you reply.");
  });

  it("is plain text with exactly three links and no tracking", () => {
    for (const personalData of [false, true]) {
      const { body } = renderLetter(letterInput({ personalData }));
      expect(body).not.toMatch(/<[a-z!/]/i); // no HTML, so no pixel
      const links = body.match(/https?:\/\/\S+/g) ?? [];
      expect(new Set(links.map((link) => new URL(link).host))).toEqual(new Set(["bidfolio.co.uk"]));
      expect(links).toHaveLength(3); // the page, the opt-out, the privacy notice
      expect(body).not.toMatch(/bit\.ly|tinyurl|t\.co\/|utm_/i);
    }
  });

  it("names no UK representative and no ICO number until there is one, and cannot be broken by line breaks in a name", () => {
    // No bracket either when the registered name is the name already given.
    const sender = { ...letterInput().sender, legalName: "Fay Founder", ukRepresentative: null, icoNumber: null };
    const { body, subject } = renderLetter(letterInput({ sender, fields: { ...letterInput().fields, company: "Acme\r\nGrounds Ltd" } }));
    expect(body).toContain("Bidfolio is operated by Fay Founder, an independent sole trader registered in Ukraine. 1 Example Street, Poltava, 36000, Ukraine. Contact: fay@getbidfolio.example.\n\nTo stop these emails");
    expect(body).not.toMatch(/representative/i);
    expect(body).not.toContain("ICO registration");
    expect(subject).toBe("Acme Grounds Ltd: your public contract awards on one page (from Bidfolio)");
    expect(Object.keys(LETTER_TEMPLATES)).toEqual(["award_page_v1"]);
  });
});

describe("sender details", () => {
  it("are the operator's own, kept in one place; a placeholder in site.ts does not count", () => {
    const sender = outreachSender();
    // Everything a letter must say about who is writing is there (PECR reg. 23(a)).
    expect(senderProblems(sender, { includesNamed: false })).toEqual([]);
    expect(sender.fullName).toBeTruthy();
    expect(sender.fullName!.startsWith(`${sender.firstName} `)).toBe(true);
    expect(sender.description).toBe("an independent sole trader registered in Ukraine");
    expect(sender.postalAddress).toContain("Ukraine");
    expect(sender.contactEmail).toBe(`hello@${site.domain}`);
    // The representative and the ICO number are read from site.operator, where null means "not there yet".
    expect(sender.ukRepresentative).toBe(site.operator.ukRepresentative);
    expect(sender.icoNumber).toBe(site.operator.icoRegistrationNumber);
    expect(ukRepresentativeAppointed(sender)).toBe(sender.ukRepresentative !== null);
  });

  it("a letter cannot be exported without the operator's details; a named address also needs the UK representative", () => {
    const complete = { ...outreachSender(), ukRepresentative: null };
    expect(senderProblems(complete, { includesNamed: false })).toEqual([]);
    expect(senderProblems(complete, { includesNamed: true }).map((problem) => problem.field)).toEqual(["ukRepresentative"]);
    expect(senderProblems({ ...complete, ukRepresentative: "Example Rep Ltd, 2 Sample Road, London" }, { includesNamed: true })).toEqual([]);
    expect(senderProblems({ ...complete, postalAddress: null, contactEmail: null }, { includesNamed: false }).map((problem) => problem.field)).toEqual(["postalAddress", "contactEmail"]);
    expect(ukRepresentativeAppointed(complete)).toBe(false);
  });

  it("the footer line says who operates the service, and never invents a representative", () => {
    const sender = { ...outreachSender(), fullName: "Fay Founder", contactEmail: "fay@getbidfolio.example" };
    expect(operatorFooterLine({ ...sender, ukRepresentative: null })).toBe(
      "Bidfolio is operated by Fay Founder, an independent sole trader registered in Ukraine (Kremenchuk). Contact: fay@getbidfolio.example · UK representative: being appointed",
    );
    expect(operatorFooterLine({ ...sender, ukRepresentative: "Example Rep Ltd, London" })).toContain("· UK representative: Example Rep Ltd, London");
  });

  it("the letter and the privacy notice promise the same number of days for a named address", () => {
    expect(RETENTION_DAYS.outreachNamedAddresses).toBe(site.facts.outreachRetentionDays);
  });
});

describe("CSV export", () => {
  it("neutralises cells a spreadsheet would run as a formula", () => {
    expect(guardCell("=HYPERLINK(\"https://evil.example\",\"Click\")")).toBe("'=HYPERLINK(\"https://evil.example\",\"Click\")");
    expect(guardCell("+44 Cleaning Ltd")).toBe("'+44 Cleaning Ltd");
    expect(guardCell("-1+1")).toBe("'-1+1");
    expect(guardCell("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)");
    expect(guardCell("\tcmd")).toBe("'\tcmd");
    expect(guardCell("\rcmd")).toBe("'\rcmd");
    // Ordinary text, including these characters further in, is untouched.
    expect(guardCell("Acme = Best Ltd")).toBe("Acme = Best Ltd");
    expect(guardCell("tenders@acme.example")).toBe("tenders@acme.example");
    expect(guardCell(null)).toBe("");
    expect(guardCell("a\u0000b")).toBe("ab");
  });

  it("quotes every field (RFC 4180), doubles quotes and keeps line breaks inside a field", () => {
    expect(csvField('He said "hello", twice')).toBe('"He said ""hello"", twice"');
    expect(csvField("line one\nline two\r\nline three")).toBe('"line one\r\nline two\r\nline three"');
    const csv = toCsv(["email", "body"], [["tenders@acme.example", 'Hello,\n\n"Quoted", with a comma'], ["=cmd|' /C calc'!A0", ""]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toBe(`${CSV_BOM}"email","body"\r\n"tenders@acme.example","Hello,\r\n\r\n""Quoted"", with a comma"\r\n"'=cmd|' /C calc'!A0",""\r\n`);
    // Round trip: what a spreadsheet reads back.
    expect(parseCsv(csv)).toEqual([
      ["email", "body"],
      ["tenders@acme.example", 'Hello,\r\n\r\n"Quoted", with a comma'],
      ["'=cmd|' /C calc'!A0", ""],
    ]);
  });

  it("writes non-ASCII text as UTF-8 behind a byte-order mark", () => {
    const bytes = Buffer.from(toCsv(["a"], [["Café – £5"]]), "utf8");
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString("utf8")).toContain("Café – £5");
  });
});

describe("segment", () => {
  it("has the documented defaults: 30 days, generic mailboxes, SMEs, a batch of 100", () => {
    expect(segmentFromParams({})).toEqual({ segment: DEFAULT_SEGMENT, fieldErrors: {} });
    expect(DEFAULT_SEGMENT).toMatchObject({ publishedWithinDays: 30, mailbox: "generic", smeOnly: true, batchSize: 100 });
  });

  it("reads the builder form and writes the same query string back", () => {
    const { segment } = segmentFromParams({ divisions: ["50", "45"], groups: "797, 799", regions: ["UKE"], days: "21", min: "£25k", max: "1.5m", mailbox: "generic_and_named", size: "any", batch: "400" });
    expect(segment).toEqual({ cpvDivisions: ["45", "50"], cpvGroups: ["797", "799"], regions: ["UKE"], publishedWithinDays: 21, valueMin: 25_000, valueMax: 1_500_000, mailbox: "generic_and_named", smeOnly: false, batchSize: 400 });
    const params = segmentToParams(segment!);
    expect(segmentFromParams({ ...Object.fromEntries(params.entries()), divisions: params.getAll("divisions"), regions: params.getAll("regions") }).segment).toEqual(segment);
    expect(describeSegment(segment!)).toBe("Construction work, Repair and maintenance, CPV group 797, CPV group 799 · Yorkshire and the Humber · last 21 days · £25,000–£1,500,000 · generic and named addresses · any company size");
  });

  it("rejects what the server must never accept", () => {
    const errors = (params: Record<string, string>) => Object.keys(segmentFromParams(params).fieldErrors);
    expect(errors({ batch: "401" })).toEqual(["batchSize"]);
    expect(errors({ batch: "0" })).toEqual(["batchSize"]);
    expect(errors({ days: "0" })).toEqual(["publishedWithinDays"]);
    expect(errors({ days: "abc" })).toEqual(["publishedWithinDays"]);
    expect(errors({ divisions: "4" })).toEqual(["cpvDivisions"]);
    expect(errors({ groups: "79,7x" })).toEqual(["cpvGroups"]);
    expect(errors({ regions: "FR" })).toEqual(["regions"]);
    expect(errors({ mailbox: "everyone" })).toEqual(["mailbox"]);
    expect(errors({ min: "lots" })).toEqual(["valueMin"]);
    expect(errors({ min: "500000", max: "1000" })).toEqual(["valueMax"]);
    expect(segmentSchema.safeParse({ ...DEFAULT_SEGMENT, batchSize: 1000 }).success).toBe(false);
    expect(parsePounds("")).toBeNull();
    expect(parsePounds("25,000")).toBe(25_000);
  });
});

describe("suppression list", () => {
  it("accepts an address or a domain, however the domain is typed", () => {
    expect(normaliseTarget(" Tenders@Acme.Example ")).toEqual({ kind: "email", value: "tenders@acme.example", domain: "acme.example" });
    for (const typed of ["acme.example", "@acme.example", "*.acme.example", "https://www.acme.example/contact", "ACME.EXAMPLE."]) {
      expect(normaliseTarget(typed), typed).toEqual({ kind: "domain", value: "acme.example" });
    }
    for (const junk of ["", "acme", "not an address", "a@b", "co.uk", "@", "tenders@"]) expect(normaliseTarget(junk), junk).toBeNull();
    expect(normaliseEmail("someone@acme.example ")).toEqual({ email: "someone@acme.example", domain: "acme.example" });
    expect(normaliseEmail("someone at acme")).toBeNull();
  });

  it("covers an address by its own entry, its domain or a parent domain", () => {
    expect(domainAndParents("mail.acme.example")).toEqual(["mail.acme.example", "acme.example"]);
    const index = buildSuppressionIndex([
      { email: "tenders@acme.example", domain: null, reason: "optout", createdAt: "2026-11-01T00:00:00Z" },
      { email: null, domain: "brightway.example", reason: "complaint", createdAt: "2026-11-02T00:00:00Z" },
    ]);
    expect(index.size).toBe(2);
    expect(index.match("TENDERS@acme.example")).toMatchObject({ via: "email", reason: "optout" });
    expect(index.match("info@acme.example")).toBeNull();
    expect(index.match("anyone@brightway.example")).toMatchObject({ via: "domain", reason: "complaint" });
    expect(index.match("anyone@mail.brightway.example")).toMatchObject({ via: "domain" });
    expect(index.match("anyone@notbrightway.example")).toBeNull();
  });

  it("finds every address in a pasted bounce list or a CSV", () => {
    const text = [
      "bounced@acme.example",
      '"Jo Example" <jo.example@brightway.example>; 550 5.1.1 user unknown',
      "recipient,reason\r\nINFO@Castle.Example,mailbox full\r\nbounced@acme.example,duplicate",
      "not-an-address, 12345",
    ].join("\n");
    expect(extractEmails(text)).toEqual({ emails: ["bounced@acme.example", "jo.example@brightway.example", "info@castle.example"], truncated: false });
    expect(extractEmails("a@a.example b@b.example c@c.example", 2)).toEqual({ emails: ["a@a.example", "b@b.example"], truncated: true });
  });
});

const contact = (email: string, overrides: Partial<CandidateContact> = {}): CandidateContact => ({
  id: `ct_${email}`,
  email,
  emailHash: `hash:${email}`,
  emailDomain: email.split("@")[1]!,
  kind: "generic",
  namePresent: false,
  domainMatchesWebsite: null,
  firstIngestedAt: "2026-11-10T00:00:00Z",
  lastSeenAt: "2026-11-10T00:00:00Z",
  suppressedAt: null,
  ...overrides,
});

const candidate = (id: string, name: string, contacts: CandidateContact[], overrides: { supplier?: Partial<Candidate["supplier"]>; publishedAt?: string } = {}): Candidate => ({
  supplier: { id, name, slug: id, coh: "01111111", legalForm: "ltd", country: "GB", removedAt: null, mergedInto: null, scale: "sme", locality: "Leeds", region: "UKE", ...overrides.supplier },
  award: { title: "Grounds Maintenance", buyerName: "Leeds City Council", publishedAt: overrides.publishedAt ?? "2026-11-08T00:00:00Z", valueAmount: 120_000, valueGross: 144_000, currency: "GBP", valueShared: false, isFramework: false, releaseId: "800001-2026", noticeType: "UK7" },
  contacts,
});

const context = (overrides: Partial<SelectionContext> = {}): SelectionContext => ({
  suppression: buildSuppressionIndex([]),
  optedOutSupplierIds: new Set(),
  linkedSupplierIds: new Set(),
  userEmails: new Set(),
  userDomains: new Set(),
  coolOff: { emailHashes: new Set(), supplierIds: new Set() },
  ...overrides,
});

describe("selection", () => {
  it("puts every address in exactly one place, so the counts add up", () => {
    const candidates = [
      candidate("s1", "Acme Grounds Ltd", [contact("tenders@acme.example")]),
      candidate("s2", "Brightway Cleaning Ltd", [contact("jane.doe@brightway.example", { kind: "named" }), contact("info@brightway.example")]),
      candidate("s3", "Dale Gardening", [contact("info@dale.example")], { supplier: { coh: null, legalForm: "unknown" } }),
      candidate("s4", "Elm Care Ltd", [contact("office@webmail.example", { kind: "freemail" })]),
      candidate("s5", "Fenwick Builders Ltd", [contact("info@fenwick.example")], { supplier: { scale: "large" } }),
      candidate("s6", "Grange Ltd", [contact("info@other.example", { domainMatchesWebsite: false })]),
      candidate("s7", "Heath Ltd", [contact("sam@heath.example", { kind: "named" })]),
      candidate("s8", "Ivy Ltd", []),
      candidate("s9", "Jet Ltd", [contact("info@jet.example")], { supplier: { removedAt: "2026-10-01T00:00:00Z" } }),
    ];
    const { prospects, summary } = selectProspects(candidates, DEFAULT_SEGMENT, context(), NOW);
    expect(prospects.map((prospect) => [prospect.supplier.name, prospect.contact.email, prospect.emailKind])).toEqual([
      ["Acme Grounds Ltd", "tenders@acme.example", "generic"],
      ["Brightway Cleaning Ltd", "info@brightway.example", "generic"],
    ]);
    expect(summary).toMatchObject({ companiesMatched: 9, companiesWithoutAddress: 1, addressesConsidered: 9, eligibleCompanies: 2, listed: 2, listedGeneric: 2, listedNamed: 0 });
    expect(summary.excluded).toEqual({
      supplier_removed: 1,
      suppressed: 0,
      not_eligible: 2,
      domain_mismatch: 1,
      named_not_selected: 2,
      not_sme: 1,
      already_user: 0,
      cool_off: 0,
      duplicate_address: 0,
      duplicate_company: 0,
      over_batch: 0,
    });
    expect(summary.notEligibleByReason).toEqual({ no_company_number: 1, freemail_domain: 1 });
    const total = summary.listed + Object.values(summary.excluded).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(summary.addressesConsidered);
  });

  it("one prospect per company: the generic mailbox first, then the address on the company's own website", () => {
    const company = candidate("s1", "Acme Grounds Ltd", [
      contact("zoe.adams@acme.example", { kind: "named" }),
      contact("info@acme.example"),
      contact("tenders@acme.example", { domainMatchesWebsite: true }),
    ]);
    const named = { ...DEFAULT_SEGMENT, mailbox: "generic_and_named" as const };
    const { prospects, summary } = selectProspects([company], named, context(), NOW);
    expect(prospects).toHaveLength(1);
    expect(prospects[0]!.contact.email).toBe("tenders@acme.example");
    expect(summary.excluded.duplicate_company).toBe(2);
    // With only a named address left, that one is used — and carries its contact-by date.
    const onlyNamed = selectProspects([candidate("s1", "Acme Grounds Ltd", [contact("zoe.adams@acme.example", { kind: "named" })])], named, context(), NOW);
    expect(onlyNamed.prospects[0]).toMatchObject({ emailKind: "named", personalData: true, contactBy: "2026-12-10T00:00:00.000Z" });
    expect(onlyNamed.summary).toMatchObject({ listedNamed: 1, listedGeneric: 0 });
  });

  it("uses the legal gate: a named address past one month is not eligible in any mode", () => {
    const stale = candidate("s1", "Acme Grounds Ltd", [contact("zoe.adams@acme.example", { kind: "named", firstIngestedAt: "2026-10-01T00:00:00Z" })]);
    const { prospects, summary } = selectProspects([stale], { ...DEFAULT_SEGMENT, mailbox: "generic_and_named" }, context(), NOW);
    expect(prospects).toEqual([]);
    expect(summary.notEligibleByReason).toEqual({ named_address_past_one_month: 1 });
  });

  it("never lists a suppressed address, whichever way it is suppressed", () => {
    const candidates = [
      candidate("s1", "Listed Address Ltd", [contact("tenders@one.example")]),
      candidate("s2", "Listed Domain Ltd", [contact("info@mail.two.example")]),
      candidate("s3", "Stamped Row Ltd", [contact("info@three.example", { suppressedAt: "2026-11-01T00:00:00Z" })]),
      candidate("s4", "Opted Out Company Ltd", [contact("info@four.example"), contact("sales@four.example")]),
      candidate("s5", "Free Ltd", [contact("info@five.example")]),
    ];
    const suppression = buildSuppressionIndex([
      { email: "tenders@one.example", domain: null, reason: "optout", createdAt: NOW },
      { email: null, domain: "two.example", reason: "manual", createdAt: NOW },
    ]);
    const { prospects, summary } = selectProspects(candidates, DEFAULT_SEGMENT, context({ suppression, optedOutSupplierIds: new Set(["s4"]) }), NOW);
    expect(prospects.map((prospect) => prospect.supplier.id)).toEqual(["s5"]);
    expect(summary.excluded.suppressed).toBe(5);
  });

  it("leaves out users and anyone inside the cool-off window", () => {
    const candidates = [
      candidate("s1", "Claimed Ltd", [contact("info@claimed.example")]),
      candidate("s2", "User Address Ltd", [contact("info@user.example")]),
      candidate("s3", "User Domain Ltd", [contact("tenders@domain.example")]),
      candidate("s4", "Written To Ltd", [contact("info@written.example")]),
      candidate("s5", "Same Address Ltd", [contact("shared@group.example")]),
      candidate("s6", "Fresh Ltd", [contact("info@fresh.example")]),
    ];
    const { prospects, summary } = selectProspects(
      candidates,
      DEFAULT_SEGMENT,
      context({
        linkedSupplierIds: new Set(["s1"]),
        userEmails: new Set(["info@user.example"]),
        userDomains: new Set(["domain.example"]),
        coolOff: { supplierIds: new Set(["s4"]), emailHashes: new Set(["hash:shared@group.example"]) },
      }),
      NOW,
    );
    expect(prospects.map((prospect) => prospect.supplier.id)).toEqual(["s6"]);
    expect(summary.excluded).toMatchObject({ already_user: 3, cool_off: 2 });
  });

  it("uses an address once per list and falls back to the company's next address", () => {
    const candidates = [
      candidate("s1", "Maple North Ltd", [contact("group@maple.example")], { publishedAt: "2026-11-09T00:00:00Z" }),
      candidate("s2", "Maple South Ltd", [contact("group@maple.example"), contact("south@maple.example", { kind: "named" })], { publishedAt: "2026-11-08T00:00:00Z" }),
      candidate("s3", "Maple West Ltd", [contact("group@maple.example")], { publishedAt: "2026-11-07T00:00:00Z" }),
    ];
    const { prospects, summary } = selectProspects(candidates, { ...DEFAULT_SEGMENT, mailbox: "generic_and_named" }, context(), NOW);
    expect(prospects.map((prospect) => [prospect.supplier.id, prospect.contact.email])).toEqual([
      ["s1", "group@maple.example"],
      ["s2", "south@maple.example"],
    ]);
    expect(summary.excluded.duplicate_address).toBe(2);
    expect(new Set(prospects.map((prospect) => prospect.contact.email)).size).toBe(prospects.length);
  });

  it("cuts the batch from the newest awards and counts the rest", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => candidate(`s${index}`, `Company ${index} Ltd`, [contact(`info@c${index}.example`)], { publishedAt: `2026-11-0${index + 1}T00:00:00Z` }));
    const { prospects, summary } = selectProspects(candidates, { ...DEFAULT_SEGMENT, batchSize: 2 }, context(), NOW);
    expect(prospects.map((prospect) => prospect.supplier.id)).toEqual(["s4", "s3"]);
    expect(summary).toMatchObject({ eligibleCompanies: 5, listed: 2 });
    expect(summary.excluded.over_batch).toBe(3);
  });
});

const counts = (overrides: Partial<FunnelCounts> = {}): FunnelCounts => ({
  sent: 400,
  visited: 0,
  claimed: 0,
  bidChecks: 0,
  cardPayments: 0,
  optedOut: 0,
  bounced: 0,
  complaints: 0,
  lastSentAt: new Date("2026-11-01T12:00:00Z"),
  ...overrides,
});

describe("results against the falsification test (DECISION.md §6)", () => {
  it("shows counts, and a percentage only from 100 e-mails", () => {
    expect(describeShare(7, 40)).toBe("7 of 40");
    expect(describeShare(7, 99)).toBe("7 of 99");
    expect(describeShare(31, 400)).toBe("31 of 400 (8%)");
    expect(describeShare(1, 400)).toBe("1 of 400 (under 1%)");
    expect(describeShare(0, 0)).toBe("0 of 0");
  });

  it("uses the thresholds as written for 400 and in proportion otherwise", () => {
    expect(thresholdsFor(400)).toEqual({ passVisits: 30, passClaims: 10, passPacks: 3, passCardPayments: 2, killVisitsBelow: 12, scaled: false });
    expect(thresholdsFor(200)).toEqual({ passVisits: 15, passClaims: 5, passPacks: 2, passCardPayments: 1, killVisitsBelow: 6, scaled: true });
    expect(thresholdsFor(100)).toMatchObject({ passVisits: 8, passClaims: 3, passPacks: 1, passCardPayments: 1, killVisitsBelow: 3 });
  });

  it("pass needs visits, claims and (packs or card payments)", () => {
    expect(readFunnel(counts({ visited: 30, claimed: 10, bidChecks: 3 }), NOW).verdict).toBe("pass");
    expect(readFunnel(counts({ visited: 30, claimed: 10, bidChecks: 0, cardPayments: 2 }), NOW).verdict).toBe("pass");
    expect(readFunnel(counts({ visited: 30, claimed: 10, bidChecks: 2, cardPayments: 1 }), NOW).verdict).toBe("between");
    expect(readFunnel(counts({ visited: 29, claimed: 10, bidChecks: 3 }), NOW).verdict).toBe("between");
  });

  it("kill is fewer than 12 visits or no claims — but only once the week is up", () => {
    expect(readFunnel(counts({ visited: 11, claimed: 4 }), NOW).verdict).toBe("kill");
    expect(readFunnel(counts({ visited: 40, claimed: 0 }), NOW).verdict).toBe("kill");
    expect(readFunnel(counts({ visited: 12, claimed: 1 }), NOW).verdict).toBe("between");
    const early = readFunnel(counts({ visited: 2, claimed: 0, lastSentAt: new Date("2026-11-10T12:00:00Z") }), NOW);
    expect(early).toMatchObject({ verdict: "too_early", headline: "Too early to judge: 4 more days" });
    // A pass does not have to wait.
    expect(readFunnel(counts({ visited: 30, claimed: 10, cardPayments: 2, lastSentAt: new Date("2026-11-12T12:00:00Z") }), NOW).verdict).toBe("pass");
  });

  it("gives no verdict and no percentages on a handful of e-mails", () => {
    const reading = readFunnel(counts({ sent: 40, visited: 7, claimed: 2 }), NOW);
    expect(reading.verdict).toBe("too_early");
    expect(reading.headline).toBe("Too few e-mails to judge: 40 sent");
    expect(reading.lines.map((line) => line.value)).toEqual(["7 of 40", "2 of 40", "0 of 40", "0 of 40"]);
    expect(JSON.stringify(reading)).not.toContain("%");
    // No line is called met or failed either: a threshold scaled down to "3 visits" would be noise.
    // The counts stand beside the test's thresholds as they are written.
    expect(reading.judged).toBe(false);
    expect(reading.scaled).toBe(false);
    expect(reading.lines.map((line) => line.state)).toEqual(["not_judged", "not_judged", "not_judged", "not_judged"]);
    expect(reading.lines[0]!.target).toBe("pass at 30 of 400, kill below 12");
    expect(readFunnel(counts({ sent: 40, visited: 0, claimed: 0 }), NOW).lines.every((line) => line.state === "not_judged")).toBe(true);
    expect(readFunnel(counts({ sent: 0, lastSentAt: null }), NOW)).toMatchObject({ verdict: "too_early", headline: "Nothing sent yet", judged: false });
    // From 100 e-mails the lines are judged, against thresholds in proportion.
    const judged = readFunnel(counts({ sent: 100, visited: 8, claimed: 0 }), NOW);
    expect(judged).toMatchObject({ judged: true, scaled: true, verdict: "kill" });
    expect(judged.lines.map((line) => line.state)).toEqual(["pass", "kill", "below", "below"]);
    expect(judged.lines[0]!.target).toBe("pass at 8, kill below 3");
  });

  it("more than two complaints stops the test whatever else happened", () => {
    expect(readFunnel(counts({ visited: 60, claimed: 20, bidChecks: 5, complaints: 3 }), NOW)).toMatchObject({ verdict: "stopped", headline: "Stop: 3 complaints" });
    expect(readFunnel(counts({ visited: 60, claimed: 20, bidChecks: 5, complaints: 2 }), NOW).verdict).toBe("pass");
  });

  it("does not claim a pass, or a zero, for what cannot be measured yet", () => {
    const reading = readFunnel(counts({ visited: 35, claimed: 12, bidChecks: null, cardPayments: null }), NOW);
    expect(reading.verdict).toBe("between");
    expect(reading.lines.find((line) => line.key === "packs")).toMatchObject({ value: "—", state: "unknown" });
    expect(reading.detail).toContain("cannot be measured yet");
  });
});
