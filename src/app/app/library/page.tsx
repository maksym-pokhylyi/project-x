import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { reviveLibraryDocs } from "@/features/library/server/docs";
import { DocsPanel, type LibraryDocItem } from "@/features/library/components/docs-panel";
import { CompanyFactsForm } from "@/features/library/components/facts-form";
import { listLibraryDocs } from "@/features/library/server/docs";
import { getCompanyFacts } from "@/features/library/server/facts";
import type { LibraryDocKind } from "@/features/bids/types";
import { requireOrgForPage } from "@/server/session";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";
// The website draft (fetch + one model call) and document processing start from here.
export const maxDuration = 300;

/** Evidence library: company facts (confirmed by a person) and the documents drafts may quote. */
export default async function LibraryPage() {
  const ctx = await requireOrgForPage({ returnTo: "/app/library" });
  const [record, docs] = await Promise.all([getCompanyFacts(ctx), listLibraryDocs(ctx)]);
  await reviveLibraryDocs(docs);
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
  }));

  return (
    <div className="space-y-10">
      <PageHeader
        title="Evidence library"
        description="What your drafts are allowed to say about you. Drafts use only the facts you confirm and the documents you upload here — anything missing is marked “Evidence needed”, never invented."
      />
      <section aria-labelledby="facts-heading" className="space-y-4">
        <div>
          <h2 id="facts-heading" className="text-lg font-semibold tracking-tight">
            Company facts
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">Requirements in every bid are compared with these facts: insurance levels, turnover, accreditations and their expiry dates.</p>
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <CompanyFactsForm
            key={`${record.updatedAt?.toISOString() ?? "new"}-${record.draft ? "draft" : "none"}`}
            facts={record.facts}
            draft={record.draft}
            draftSource={record.draftSource}
            confirmedAt={record.confirmedAt?.toISOString() ?? null}
          />
        </div>
      </section>
      <section aria-labelledby="docs-heading" className="space-y-4">
        <div>
          <h2 id="docs-heading" className="text-lg font-semibold tracking-tight">
            Documents <span className="text-sm font-normal text-muted-foreground tabular-nums">{items.length}</span>
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">Each document is read, summarised and typed. Fix the type or the valid-until date if we got it wrong.</p>
        </div>
        <DocsPanel docs={items} />
      </section>
    </div>
  );
}
