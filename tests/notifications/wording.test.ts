import { describe, expect, it } from "vitest";
import { capLine, greeting, radarClosing, radarIntro, reminderHeadline, renewalHeadline, RENEWAL_BODY, SIGN_OFF } from "@/features/notifications/emails/copy";
import {
  alertSubject,
  calmCase,
  clipTitle,
  closesIn,
  countOf,
  digestSubject,
  firstName,
  formatContractValue,
  formatEstimate,
  reminderSubject,
  renewalSubject,
  shortCompanyName,
  singleLine,
  SUBJECT_MAX,
  truncateAtWord,
} from "@/features/notifications/wording";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("subject lines", () => {
  it("reads like the example in the brief", () => {
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 3, ending: 2 })).toBe("3 new tenders for Aldermoor & Pike · 2 contracts ending soon");
  });

  it("uses the singular for one and the plural for the rest", () => {
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 1, ending: 1 })).toBe("1 new tender for Aldermoor & Pike · 1 contract ending soon");
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 2, ending: 0 })).toBe("2 new tenders for Aldermoor & Pike");
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 1, ending: 0 })).toBe("1 new tender for Aldermoor & Pike");
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 12, ending: 3 })).toBe("12 new tenders for Aldermoor & Pike · 3 contracts ending soon");
    expect(alertSubject({ company: "Aldermoor & Pike", matches: 1 })).toBe("1 new tender for Aldermoor & Pike");
    expect(alertSubject({ company: "Aldermoor & Pike", matches: 8 })).toBe("8 new tenders for Aldermoor & Pike");
  });

  it("leads with the contracts when no tender is new, and never says 0 new tenders", () => {
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 0, ending: 2 })).toBe("2 contracts ending soon in your trade · Aldermoor & Pike");
    expect(digestSubject({ company: "Aldermoor & Pike", matches: 0, ending: 1 })).toBe("1 contract ending soon in your trade · Aldermoor & Pike");
  });

  it("stays under 78 characters: the name gives way first, then the second half", () => {
    const long = "The Worshipful Company of Northern Counties Scaffolding and Access Contractors";
    const withTail = digestSubject({ company: long, matches: 3, ending: 2 });
    expect(withTail.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(withTail).toBe("3 new tenders for The Worshipful Company of… · 2 contracts ending soon");
    const withoutTail = digestSubject({ company: long, matches: 3, ending: 0 });
    expect(withoutTail.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(withoutTail.startsWith("3 new tenders for The Worshipful Company of Northern Counties")).toBe(true);
    expect(withoutTail.endsWith("…")).toBe(true);
    // The counts are never cut, whatever the name.
    for (const company of ["A", long, "X".repeat(200), "Aldermoor & Pike Building Services (North West) Holdings"]) {
      for (const [matches, ending] of [[1, 0], [3, 2], [128, 47], [0, 5]] as const) {
        const subject = digestSubject({ company, matches, ending });
        expect(subject.length).toBeLessThanOrEqual(77);
        expect(subject).toContain(matches > 0 ? `${matches} new tender` : `${ending} contract`);
        expect(subject).not.toMatch(/\s…|[,;:·&(-]…/); // no dangling punctuation before the ellipsis
        expect(EMOJI.test(subject)).toBe(false);
      }
    }
  });

  it("cannot be broken into extra header lines by a name", () => {
    const subject = digestSubject({ company: "Acme\r\nBcc: someone@example.com", matches: 2, ending: 0 });
    expect(subject).toBe("2 new tenders for Acme Bcc: someone@example.com");
    const separators = [0x2028, 0x2029, 0x0000, 0x0009].map((code) => String.fromCharCode(code));
    expect(singleLine(`a${separators[0]}b${separators[1]}c${separators[2]}d${separators[3]}e`)).toBe("a b c d e");
  });

  it("words deadline and renewal subjects as facts", () => {
    expect(reminderSubject({ daysLeft: 2, title: "School kitchen refurbishments, Phase 2", more: 0 })).toBe("Closes in 2 days: School kitchen refurbishments, Phase 2");
    expect(reminderSubject({ daysLeft: 7, title: "School kitchen refurbishments, Phase 2", more: 1 })).toBe("Closes in 7 days: School kitchen refurbishments, Phase 2 (+1 more)");
    expect(reminderSubject({ daysLeft: 1, title: "Grounds maintenance", more: 0 })).toBe("Closes tomorrow: Grounds maintenance");
    const long = reminderSubject({ daysLeft: 2, title: "Provision of responsive repairs, voids and planned maintenance to housing stock across the borough", more: 3 });
    expect(long.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(long.startsWith("Closes in 2 days: Provision of responsive repairs")).toBe(true);
    expect(long.endsWith("… (+3 more)")).toBe(true);
    expect(closesIn(0)).toBe("Closes today");
    expect(renewalSubject({ planName: "Bid Desk", daysLeft: 7 })).toBe("Your Bid Desk annual plan renews in 7 days");
    expect(renewalSubject({ planName: "Bid Desk", daysLeft: 1 })).toBe("Your Bid Desk annual plan renews tomorrow");
  });
});

describe("names", () => {
  it("shortens a registered name to what people call the company", () => {
    expect(shortCompanyName("Aldermoor & Pike Building Services Ltd")).toBe("Aldermoor & Pike");
    expect(shortCompanyName("Greaves Hollin Contractors Limited")).toBe("Greaves Hollin");
    expect(shortCompanyName("Acme Grounds Ltd")).toBe("Acme Grounds");
    expect(shortCompanyName("Harbour Catering Ltd T/A The Quay Kitchen")).toBe("Harbour Catering");
    // Never down to one word, never to nothing.
    expect(shortCompanyName("Property Services Ltd")).toBe("Property Services");
    expect(shortCompanyName("Services Limited")).toBe("Services");
    expect(shortCompanyName("KPMG LLP")).toBe("KPMG");
  });

  it("calms a name published in capitals, and leaves a name typed with care alone", () => {
    expect(calmCase("NEWBURY COMMERCIAL GLAZING")).toBe("Newbury Commercial Glazing");
    expect(shortCompanyName("NEWBURY COMMERCIAL GLAZING LIMITED")).toBe("Newbury Commercial Glazing");
    expect(calmCase("A R DEMOLITION")).toBe("A R Demolition");
    expect(calmCase("MCDONALD AND SONS")).toBe("McDonald and Sons");
    expect(calmCase("KPMG")).toBe("KPMG");
    expect(calmCase("SEE Services")).toBe("SEE Services");
    expect(calmCase("eBay UK")).toBe("eBay UK");
  });

  it("greets by first name when there is one", () => {
    expect(firstName("Joanne Pike")).toBe("Joanne");
    expect(firstName("  ")).toBeNull();
    expect(greeting("Joanne")).toBe("Joanne,");
    expect(greeting(null)).toBe("Hello,");
  });
});

describe("numbers and money", () => {
  it("counts with the right noun", () => {
    expect(countOf(1, "new tender")).toBe("1 new tender");
    expect(countOf(3, "new tender")).toBe("3 new tenders");
    expect(countOf(1, "more match", "more matches")).toBe("1 more match");
    expect(countOf(1200, "contract")).toBe("1,200 contracts");
  });

  it("marks an estimate as an estimate and never invents a value", () => {
    expect(formatEstimate(640_000)).toBe("est. £640,000");
    expect(formatEstimate(1_100_000)).toBe("est. £1.1m");
    expect(formatEstimate(null)).toBeNull();
    expect(formatEstimate(undefined)).toBeNull();
    expect(formatEstimate(0)).toBeNull();
    expect(formatEstimate(Number.NaN)).toBeNull();
    expect(formatContractValue(2_100_000)).toBe("£2,100,000");
    expect(formatContractValue(null)).toBeNull();
  });

  it("cuts long text at a word", () => {
    expect(truncateAtWord("one two three four", 12)).toBe("one two…");
    expect(truncateAtWord("short", 12)).toBe("short");
    expect(truncateAtWord("abcdefghijklmnop", 8)).toBe("abcdefg…");
    const title = "Provision of a framework for the supply, installation, servicing and maintenance of commercial catering equipment to schools and corporate sites across the county";
    expect(clipTitle(title).length).toBeLessThanOrEqual(140);
    expect(clipTitle(title).endsWith("…")).toBe(true);
    expect(clipTitle("Line one\nline two")).toBe("Line one line two");
  });
});

describe("sentences", () => {
  const monday = new Date("2026-11-16T07:30:00Z");
  const base = { company: "Aldermoor & Pike", now: monday, firstLookbackDays: 7 };
  const lastWeek = { at: new Date("2026-11-09T07:30:00Z"), first: false };

  it("opens the digest with the counts, in words, with verbs that agree", () => {
    expect(radarIntro({ ...base, kind: "digest", matches: 3, ending: 2, since: lastWeek })).toBe(
      "Three new tenders match Aldermoor & Pike this week, and two contracts held by others are coming to an end.",
    );
    expect(radarIntro({ ...base, kind: "digest", matches: 1, ending: 1, since: lastWeek })).toBe(
      "One new tender matches Aldermoor & Pike this week, and one contract held by others is coming to an end.",
    );
    expect(radarIntro({ ...base, kind: "digest", matches: 2, ending: 0, since: lastWeek })).toBe("Two new tenders match Aldermoor & Pike this week.");
    expect(radarIntro({ ...base, kind: "digest", matches: 0, ending: 2, since: lastWeek })).toBe(
      "No new tenders match Aldermoor & Pike this week, but two contracts held by others are coming to an end.",
    );
    expect(radarIntro({ ...base, kind: "digest", matches: 12, ending: 0, since: lastWeek })).toBe("12 new tenders match Aldermoor & Pike this week.");
  });

  it("says what a first digest and an alert cover", () => {
    const first = { at: new Date("2026-11-09T07:30:00Z"), first: true };
    expect(radarIntro({ ...base, kind: "digest", matches: 3, ending: 0, since: first })).toBe("Three new tenders from the last seven days match Aldermoor & Pike.");
    const yesterday = { at: new Date("2026-11-15T07:30:00Z"), first: false };
    expect(radarIntro({ ...base, kind: "alert", matches: 2, ending: 0, since: yesterday })).toBe("Since yesterday, two new tenders match Aldermoor & Pike.");
    expect(radarIntro({ ...base, kind: "alert", matches: 1, ending: 0, since: yesterday })).toBe("Since yesterday, one new tender matches Aldermoor & Pike.");
  });

  it("closes by saying whether that was everything", () => {
    const options = { since: lastWeek, now: monday, firstLookbackDays: 7, kind: "digest" as const };
    expect(radarClosing({ ...options, moreMatches: 0, moreEnding: 0 })).toBe("That is everything new since last Monday.");
    expect(radarClosing({ ...options, moreMatches: 7, moreEnding: 4 })).toBe("There is more on your radar: 7 more new tenders and 4 more contracts ending soon.");
    expect(radarClosing({ ...options, moreMatches: 1, moreEnding: 0 })).toBe("There is more on your radar: 1 more new tender.");
  });

  it("gives a capped plan one plain line", () => {
    expect(capLine(4)).toBe("4 more matches are waiting on your radar.");
    expect(capLine(1)).toBe("1 more match is waiting on your radar.");
  });

  it("states a deadline as a fact", () => {
    expect(reminderHeadline([{ daysLeft: 2 }])).toBe("This tender closes in 2 days.");
    expect(reminderHeadline([{ daysLeft: 1 }])).toBe("This tender closes tomorrow.");
    expect(reminderHeadline([{ daysLeft: 7 }, { daysLeft: 7 }])).toBe("These two tenders close in 7 days.");
    expect(reminderHeadline([{ daysLeft: 7 }, { daysLeft: 2 }, { daysLeft: 7 }])).toBe("Three tenders are closing: one in 2 days and two in 7 days.");
  });

  it("words the renewal as agreed, with no refund sentence", () => {
    expect(renewalHeadline({ planName: "Bid Desk", renewsOn: "27 Nov 2027", price: "£1,490" })).toBe("Your Bid Desk annual plan renews on 27 Nov 2027 for £1,490 (plus VAT where it applies).");
    expect(renewalHeadline({ planName: "Bid Desk", renewsOn: "27 Nov 2027", price: null })).toBe("Your Bid Desk annual plan renews on 27 Nov 2027.");
    expect(RENEWAL_BODY).toContain("Pause or cancel in two clicks from Billing. You keep access until the end of the period you have paid for.");
    expect(RENEWAL_BODY).not.toMatch(/refund|14[- ]day/i);
    expect(SIGN_OFF).toBe("Reply to this email if anything looks wrong.");
  });
});
