import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
vi.mock("next/cache", async () => (await import("./mocks/next")).cache);

import AdminLayout from "@/app/admin/layout";
import AdminCampaignPage from "@/app/admin/outreach/campaigns/[id]/page";
import { POST as campaignExportRoute } from "@/app/admin/outreach/campaigns/[id]/export/route";
import AdminOutreachPage from "@/app/admin/outreach/page";
import { POST as suppressionsExportRoute } from "@/app/admin/suppressions/export/route";
import AdminSuppressionsPage from "@/app/admin/suppressions/page";
import AdminOverviewPage from "@/app/admin/page";
import { db } from "@/db";
import { dataRequests, subscriptions, suppressions, users } from "@/db/schema";
import {
  addSuppressionAction,
  clearSentAction,
  createCampaignAction,
  discardCampaignAction,
  importBouncesAction,
  markSentAction,
  removeSuppressionAction,
  resolveDataRequestAction,
} from "@/features/outreach/actions";
import { createCampaign, previewSegment } from "@/features/outreach/server/builder";
import { clearSentMarks, discardCampaign, exportCampaignCsv, getCampaign, getProspectLetter, listCampaigns, listOutreachAudit, markProspectsSent } from "@/features/outreach/server/campaigns";
import { countOpenDataRequests, listDataRequests, resolveDataRequest } from "@/features/outreach/server/data-requests";
import { getOutreachResults } from "@/features/outreach/server/results";
import { addSuppression, exportSuppressionsCsv, importBounceList, listSuppressions, removeSuppression } from "@/features/outreach/server/suppressions";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getFounderKpis } from "@/server/admin-kpis";
import { actAs, createTestUser, type TestUser } from "../helpers/auth";
import { count, FIVE_ELIGIBLE, fingerprint, founderEmail, NOW, prospectOf, resetOutreach, seed, segment, signInFounder, submit } from "./helpers";

/**
 * Prospect lists are personal data and the suppression list is what keeps a promise:
 * only the founder (ADMIN_EMAILS, verified) may read or change either. Every function,
 * form, download and page is tried here as everyone else — and nothing may change.
 */
const TODAY = NOW.toISOString().slice(0, 10);
const ORIGIN = "http://localhost:3000";

let campaignId: string;
let prospectId: string;
let suppressionId: string;
let requestId: string;

type Attempt = () => Promise<unknown>;

/** Everything in the outreach tool and the founder's numbers that reads or writes data, with valid arguments. */
function serverFunctions(): Record<string, Attempt> {
  return {
    previewSegment: () => previewSegment(segment(), NOW),
    createCampaign: () => createCampaign({ name: "Not allowed", segment: segment(), templateVariant: "s1" }, NOW),
    listCampaigns: () => listCampaigns(),
    getCampaign: () => getCampaign(campaignId, NOW),
    getProspectLetter: () => getProspectLetter(campaignId, prospectId),
    exportCampaignCsv: () => exportCampaignCsv(campaignId, "first", NOW),
    markProspectsSent: () => markProspectsSent({ campaignId, sentOn: TODAY, prospectIds: [prospectId] }, NOW),
    clearSentMarks: () => clearSentMarks({ campaignId, prospectIds: [prospectId] }, NOW),
    discardCampaign: () => discardCampaign(campaignId),
    listOutreachAudit: () => listOutreachAudit(),
    getOutreachResults: () => getOutreachResults(campaignId, NOW),
    listSuppressions: () => listSuppressions({ query: "acme" }),
    addSuppression: () => addSuppression({ target: "someone@new.example", reason: "manual" }),
    importBounceList: () => importBounceList("bounce@new.example"),
    removeSuppression: () => removeSuppression({ id: suppressionId, confirmation: "tenders@acmegrounds.example" }),
    exportSuppressionsCsv: () => exportSuppressionsCsv(),
    listDataRequests: () => listDataRequests(),
    countOpenDataRequests: () => countOpenDataRequests(),
    resolveDataRequest: () => resolveDataRequest({ id: requestId, action: "erase_contact" }),
    getFounderKpis: () => getFounderKpis(NOW),
  };
}

/** Every form of the outreach pages, filled in correctly. */
function forms(): Record<string, () => Promise<{ url: string }>> {
  return {
    createCampaign: () => submit(createCampaignAction, { name: "Not allowed", templateVariant: "s1", segment: JSON.stringify(segment()) }),
    markSent: () => submit(markSentAction, { campaignId, sentOn: TODAY, scope: "selected", ids: [prospectId] }),
    clearSent: () => submit(clearSentAction, { campaignId, ids: [prospectId] }),
    discardCampaign: () => submit(discardCampaignAction, { campaignId }),
    addSuppression: () => submit(addSuppressionAction, { target: "someone@new.example", reason: "manual" }),
    importBounces: () => submit(importBouncesAction, { list: "bounce@new.example" }),
    removeSuppression: () => submit(removeSuppressionAction, { id: suppressionId, confirmation: "tenders@acmegrounds.example" }),
    resolveDataRequest: () => submit(resolveDataRequestAction, { id: requestId, action: "hide_page" }),
  };
}

const downloads = (): Record<string, () => Promise<Response>> => ({
  campaignCsv: () =>
    campaignExportRoute(new Request(`${ORIGIN}/admin/outreach/campaigns/${campaignId}/export`, { method: "POST", headers: { origin: ORIGIN }, body: new URLSearchParams({ letter: "first" }) }), {
      params: Promise.resolve({ id: campaignId }),
    }),
  suppressionsCsv: () => suppressionsExportRoute(new Request(`${ORIGIN}/admin/suppressions/export`, { method: "POST", headers: { origin: ORIGIN } }), undefined),
});

/** The pages themselves: each one checks the founder before it reads anything. */
const pages = (): Record<string, Attempt> => ({
  layout: () => AdminLayout({ children: null }),
  overview: () => AdminOverviewPage(),
  outreach: () => AdminOutreachPage({ searchParams: Promise.resolve({ preview: "1" }) }),
  campaign: () => AdminCampaignPage({ params: Promise.resolve({ id: campaignId }), searchParams: Promise.resolve({ letter: prospectId }) }),
  suppressions: () => AdminSuppressionsPage({ searchParams: Promise.resolve({ q: "acme" }) }),
});

const outcome = (attempt: Attempt) =>
  attempt().then(
    () => "ALLOWED",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

describe("outreach: founder only", () => {
  beforeEach(async () => {
    await resetOutreach();
    await signInFounder();
    await seed(FIVE_ELIGIBLE);
    campaignId = (await createCampaign({ name: "Week one", segment: segment({ batchSize: 3 }), templateVariant: "s1" }, NOW)).campaignId;
    prospectId = (await prospectOf("Acme Grounds Ltd")).id;
    await addSuppression({ target: "tenders@acmegrounds.example", reason: "manual" });
    suppressionId = (await db.select().from(suppressions))[0]!.id;
    requestId = (
      await db
        .insert(dataRequests)
        .values({ kind: "removal", requesterEmail: "bids@castleroofing.example", message: "Remove us.", pageUrl: "https://bidfolio.co.uk/suppliers/castle-roofing-ltd-03333333" })
        .returning({ id: dataRequests.id })
    )[0]!.id;
  });

  const everyoneElse: Array<{ who: string; signIn: () => Promise<TestUser | null>; error: typeof UnauthorizedError | typeof ForbiddenError; form: string; status: number; page: string }> = [
    {
      who: "a visitor who is not signed in",
      signIn: async () => null,
      error: UnauthorizedError,
      form: "/sign-in?redirect=%2Fadmin%2Foutreach",
      status: 401,
      page: "REDIRECT:/sign-in?redirect=%2Fadmin",
    },
    {
      who: "a customer, even the owner of a paying workspace",
      signIn: async () => {
        const customer = await createTestUser({ email: "owner@customer.example" });
        await db.insert(subscriptions).values({ organizationId: customer.organizationId, status: "active", planKey: "pro", paddleSubscriptionId: "sub_test_customer" });
        return customer;
      },
      error: ForbiddenError,
      form: "FORBIDDEN",
      status: 403,
      page: "FORBIDDEN",
    },
    {
      who: "someone holding the founder's address without having verified it",
      signIn: async () => {
        // The founder's own account, with the verification taken away: the address alone is not enough.
        const [account] = await db.select().from(users).where(eq(users.email, founderEmail));
        await db.update(users).set({ emailVerified: false }).where(eq(users.id, account!.id));
        return null; // keep the founder's session cookie
      },
      error: ForbiddenError,
      form: "FORBIDDEN",
      status: 403,
      page: "FORBIDDEN",
    },
  ];

  for (const caller of everyoneElse) {
    it(`refuses ${caller.who}: every function, form, download and page — and nothing changes`, async () => {
      const user = await caller.signIn();
      if (caller.error === UnauthorizedError) actAs(null);
      else if (user) actAs(user);
      const before = await fingerprint();
      const counts = async () => [await count("outreach_campaigns"), await count("outreach_prospects"), await count("suppressions"), await count("outreach_audit"), await count("data_requests")];
      const countsBefore = await counts();

      for (const [name, attempt] of Object.entries(serverFunctions())) {
        await expect(attempt(), name).rejects.toBeInstanceOf(caller.error);
      }
      for (const [name, post] of Object.entries(forms())) {
        expect((await post()).url, name).toBe(caller.form);
      }
      for (const [name, request] of Object.entries(downloads())) {
        const response = await request();
        expect(response.status, name).toBe(caller.status);
        expect(response.headers.get("content-type"), name).toContain("application/json");
        expect(await response.text(), name).not.toContain("@"); // the refusal carries no data
      }
      for (const [name, render] of Object.entries(pages())) {
        expect(await outcome(render), name).toBe(caller.page);
      }

      expect(await fingerprint()).toBe(before);
      expect(await counts()).toEqual(countsBefore);
    });
  }

  it("lets the founder through everywhere", async () => {
    for (const [name, attempt] of Object.entries(serverFunctions())) {
      if (["discardCampaign", "removeSuppression", "resolveDataRequest"].includes(name)) continue; // kept for the forms below
      await expect(attempt(), name).resolves.toBeDefined();
    }
    for (const [name, request] of Object.entries(downloads())) {
      const response = await request();
      expect([200, 303], name).toContain(response.status);
    }
    for (const [name, post] of Object.entries(forms())) {
      // Whatever the form answers (a notice, or a reason), it answers on one of the tool's own pages.
      expect((await post()).url, name).toMatch(/^\/admin\/(outreach|suppressions)\b/);
    }
    for (const [name, render] of Object.entries(pages())) {
      expect(await outcome(render), name).toBe("ALLOWED");
    }
  });
});
