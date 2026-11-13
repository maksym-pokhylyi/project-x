import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { BidAccessSummary } from "@/features/bids/access";
import { consumeBidAllowance, getBidAccess, getFreeCheckUse } from "@/features/bids/access";
import { UpgradePanel } from "@/features/bids/components/upgrade-panel";
import { OFFERS } from "@/features/bids/offers";
import * as bidsApi from "@/features/bids/server/bids";
import { renderEmail } from "@/lib/email/templates";
import { createTestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { scopeOf } from "./helpers";

const renews = new Date("2026-12-14T09:30:00Z");
const base: BidAccessSummary = {
  planName: "Free",
  simulated: false,
  drafting: false,
  fullBids: { limit: 0, used: 0, remaining: 0, rolledOver: null, renewsAt: renews, trial: false },
  checks: { limit: 0, used: 0, remaining: 0, renewsAt: renews },
  bidPasses: 0,
  freeCheckAvailable: false,
  next: null,
};
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");

describe("upgrade moments", () => {
  it("free check used: says what it went on and offers a Bid Pass or the trial", () => {
    const markup = renderToStaticMarkup(<UpgradePanel access={base} moment="none_left" freeCheckUse={{ title: "Bus shelter replacement", usedAt: new Date("2026-11-13T10:00:00Z") }} />);
    const copy = text(markup);
    expect(copy).toContain("Your free check is used");
    expect(copy).toContain("Your free cited bid check went on Bus shelter replacement on 13 Nov 2026.");
    expect(copy).toContain("Bid Pass £99 one-off");
    expect(copy).toContain("Bid Desk, 14-day trial £149 a month after the trial");
    expect(copy).toContain("Prices exclude VAT.");
    expect(markup).toContain(`href="${OFFERS.bidPass.href}"`);
    expect(markup).toContain(`href="${OFFERS.trial.href}"`);
    expect(markup).not.toContain(OFFERS.plus.href);
    expect(OFFERS.bidPass.href).toBe("/app/settings/billing?buy=bid_pass");
    expect(OFFERS.trial.href).toBe("/app/settings/billing?plan=pro");
    expect(OFFERS.plus.href).toBe("/app/settings/billing?plan=business");
  });

  it("month's bids used: says when more arrive, against the tender's closing date, and offers a pass or Plus", () => {
    const access = { ...base, planName: "Bid Desk", drafting: true, fullBids: { ...base.fullBids, limit: 3, used: 3 } };
    const markup = renderToStaticMarkup(<UpgradePanel access={access} moment="none_left" tenderClosesAt={new Date("2026-12-16T12:00:00Z")} />);
    const copy = text(markup);
    expect(copy).toContain("You have used this month's 3 bids");
    expect(copy).toContain("Your next 3 bids arrive on 14 Dec 2026. This tender closes on 16 Dec 2026.");
    expect(copy).toContain("3 of 3 used");
    expect(copy).toContain("One more full bid now, on top of your plan.");
    expect(copy).toContain("Or wait until 14 Dec 2026.");
    expect(markup).toContain(OFFERS.plus.href);
    expect(markup).not.toContain(OFFERS.trial.href);
    // On the top plan there is nothing to move up to; in a trial the offer is the pass alone.
    expect(renderToStaticMarkup(<UpgradePanel access={{ ...access, fullBids: { ...access.fullBids, limit: 10, used: 10 } }} moment="none_left" />)).not.toContain(OFFERS.plus.href);
    const trial = text(renderToStaticMarkup(<UpgradePanel access={{ ...access, fullBids: { ...access.fullBids, limit: 1, used: 1, trial: true } }} moment="none_left" />));
    expect(trial).toContain("You have used the full bid in your trial");
    expect(trial).not.toContain("Bid Desk Plus");
  });

  it("locked check: keeps the check whole and puts the offer under it", () => {
    const copy = text(renderToStaticMarkup(<UpgradePanel access={base} moment="locked" />));
    expect(copy).toContain("Drafts and marking are part of a full bid");
    expect(copy).toContain("This cited check is yours to keep");
    expect(copy).toContain("Compare the plans in full");
  });
});

describe("what the free check went on", () => {
  beforeEach(resetDatabase);

  it("is known once the free check has been used", async () => {
    const user = await createTestUser();
    expect(await getFreeCheckUse(user.organizationId)).toBeNull();
    const bid = await bidsApi.createBid(scopeOf(user), { title: "Grounds maintenance" });
    expect(await consumeBidAllowance(user.organizationId, bid.id)).toEqual({ ok: true, level: "brief", source: "free_brief" });
    expect(await getFreeCheckUse(user.organizationId)).toMatchObject({ bidId: bid.id, title: "Grounds maintenance" });
    expect((await getBidAccess(user.organizationId)).next).toBeNull();
  });
});

describe("the check-ready e-mail", () => {
  it("gives the verdict, what was found and one link, and leaves out what is not known", async () => {
    const full = await renderEmail({
      name: "brief-ready",
      props: {
        name: "Joanne",
        bidTitle: "Planned and responsive maintenance",
        buyerName: "Calderbrook MBC",
        deadline: "Closes 27 Nov 2026, 12:00 · 14 days left",
        verdict: "Gaps to close",
        requirements: 40,
        passFail: 23,
        questions: 9,
        citations: { verified: 58, total: 60 },
        gates: { total: 23, met: 19, confirm: 2, gaps: 2 },
        gapNames: ["DBS register for all operatives", "Cyber Essentials certificate"],
        scoredQuestions: 6,
        coverage: "6 files, 214 pages read · 1 file not read",
        url: "https://bidfolio.co.uk/app/bids/abc",
      },
    });
    expect(full.subject).toBe("Your bid check is ready: Planned and responsive maintenance");
    for (const line of [
      "Joanne,",
      "The check on this tender pack is ready.",
      "Calderbrook MBC",
      "Closes 27 Nov 2026, 12:00 · 14 days left",
      "Gaps to close",
      "23 pass-or-fail requirements: 19 met, 2 for you to confirm, 2 gaps",
      "The gaps: DBS register for all operatives; Cyber Essentials certificate",
      "6 scored questions",
      "6 files, 214 pages read · 1 file not read",
      "2 quotes could not be matched word for word",
      "Read the gaps first.",
    ]) {
      expect(full.text.replace(/\s+/g, " ")).toContain(line);
    }
    expect(full.html).toContain('href="https://bidfolio.co.uk/app/bids/abc"');

    const bare = await renderEmail({
      name: "brief-ready",
      props: { name: "", bidTitle: "A tender", buyerName: null, deadline: null, verdict: null, requirements: 3, passFail: 1, questions: 0, citations: { verified: 3, total: 3 }, url: "https://bidfolio.co.uk/app/bids/x" },
    });
    const text = bare.text.replace(/\s+/g, " ");
    expect(text).toContain("Hello,");
    expect(text).toContain("3 requirements, 1 of them pass-or-fail");
    for (const absent of ["Verdict", "Closes", "gaps", "could not be matched"]) expect(text).not.toContain(absent);
  });
});
