import type { Metadata } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { bidQuestions } from "@/db/schema";
import "@/features/bids/components/bid-theme.css";
import type { LibraryDocKind } from "@/features/bids/types";
import { DocsPanel, type LibraryDocItem } from "@/features/library/components/docs-panel";
import { CompanyFactsForm } from "@/features/library/components/facts-form";
import { listLibraryDocs, reviveLibraryDocs } from "@/features/library/server/docs";
import { getCompanyFacts } from "@/features/library/server/facts";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";
// The website draft (fetch + one model call) and document processing start from here.
export const maxDuration = 300;

/** Documents: company facts (confirmed by a person) and the documents that checks and drafts may use. */
export default async function LibraryPage() {
  const ctx = await requireOrgForPage({ returnTo: "/app/library" });
  const [record, docs, answers] = await Promise.all([
    getCompanyFacts(ctx),
    listLibraryDocs(ctx),
    db
      .select({ bidId: bidQuestions.bidId, draftMeta: bidQuestions.draftMeta })
      .from(bidQuestions)
      .where(and(eq(bidQuestions.organizationId, ctx.organization.id), isNotNull(bidQuestions.draftMeta))),
  ]);
  await reviveLibraryDocs(docs);
  // "Used in": bids with an answer that cites the document.
  const bidsByDoc = new Map<string, Set<string>>();
  for (const answer of answers) {
    for (const ref of answer.draftMeta?.evidenceRefs ?? []) {
      if (ref.docId) bidsByDoc.set(ref.docId, (bidsByDoc.get(ref.docId) ?? new Set()).add(answer.bidId));
    }
  }
  const items: LibraryDocItem[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    kind: doc.kind as LibraryDocKind,
    size: doc.size,
    status: doc.status as LibraryDocItem["status"],
    error: doc.error,
    summary: doc.summary,
    facts: doc.keyFacts?.facts ?? [],
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt.toISOString(),
    usedIn: bidsByDoc.get(doc.id)?.size ?? 0,
  }));
  const now = new Date().getTime();

  return (
    <div className="bid-scope flex flex-col">
      <h1 className="bid-h1">Documents</h1>
      <p className="mt-2 max-w-[760px] text-[17px] leading-[1.45]">What Bidfolio knows about your company. Checks and drafts use only what is here.</p>

      <section aria-labelledby="facts-heading" className="mt-10 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="facts-heading" className="bid-h2">
            Company facts
          </h2>
          <p className="max-w-[760px] text-sm text-(--bid-muted)">Every bid check compares the pack&rsquo;s requirements with these. Correct anything that is wrong or out of date: nothing is used until you save it.</p>
        </div>
        <CompanyFactsForm
          key={`${record.updatedAt?.toISOString() ?? "new"}-${record.draft ? "draft" : "none"}`}
          facts={record.facts}
          draft={record.draft}
          draftSource={record.draftSource}
          confirmedAt={record.confirmedAt?.toISOString() ?? null}
          now={now}
        />
      </section>

      <section aria-labelledby="docs-heading" className="mt-14 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="docs-heading" className="bid-h2">
            Documents
          </h2>
          <p className="text-sm text-(--bid-muted)">
            {items.length === 0 ? "None yet." : `${items.length} document${items.length === 1 ? "" : "s"}, newest first.`} Each is read and summarised; correct the type or the valid-until date if we got it wrong.
          </p>
        </div>
        <DocsPanel docs={items} now={now} />
      </section>

      <footer className="mt-16 rounded-[10px] bg-(--bid-paper-deep) px-5 py-4 text-[13px] text-(--bid-muted)">
        <span className="font-semibold text-(--bid-ink)">Where your files are kept.</span> Your tender packs and company documents are stored in the EU (Frankfurt) and encrypted in transit and at rest. Only people in your workspace can open
        them. They are never used to train AI models.
      </footer>
    </div>
  );
}
