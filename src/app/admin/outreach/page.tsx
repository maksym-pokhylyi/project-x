import type { Metadata } from "next";
import Link from "next/link";
import { NativeSelect } from "@/components/forms/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createCampaignAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { ExclusionSummary, FunnelPanel, LawfulUsePanel } from "@/features/outreach/components/panels";
import { SegmentForm } from "@/features/outreach/components/segment-form";
import { outreachConfig } from "@/features/outreach/config";
import { subjectVariants } from "@/features/outreach/domain/letter";
import { DEFAULT_SEGMENT, describeSegment, segmentFromParams } from "@/features/outreach/domain/segment";
import { previewSegment, type SegmentPreview } from "@/features/outreach/server/builder";
import { listCampaigns } from "@/features/outreach/server/campaigns";
import { getOutreachResults } from "@/features/outreach/server/results";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Outreach" };

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));

/**
 * Founder only. The list builder: a segment, a preview of who would be written to with a
 * count of everyone left out and why, and "Create campaign". Looking stores nothing.
 * The app never sends these letters — a campaign is exported and sent by hand.
 */
export default async function AdminOutreachPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Pages render in parallel with their layout, so each admin page guards itself.
  await requireAdminForPage();
  const params = await searchParams;
  const wantsPreview = one(params.preview) === "1";
  const parsed = segmentFromParams(params);
  const raw = { groups: one(params.groups), days: one(params.days), min: one(params.min), max: one(params.max), batch: one(params.batch) };
  const showRaw = parsed.segment === null;

  let preview: SegmentPreview | null = null;
  if (wantsPreview && parsed.segment) preview = await previewSegment(parsed.segment);
  const [campaigns, results] = await Promise.all([listCampaigns(), getOutreachResults(null)]);
  const variants = subjectVariants(outreachConfig.defaultTemplateKey);
  const segment = parsed.segment ?? DEFAULT_SEGMENT;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">Build a list of companies that recently won a public contract, export the letters and send them yourself. Nothing here sends e-mail.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/outreach/suppressions">Suppressions</Link>
        </Button>
      </div>

      <Flash params={params} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Segment</CardTitle>
            <CardDescription>Who to look for. Suppressed addresses, users, companies already written to and anyone the legal gate rejects are always left out.</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentForm values={segment} raw={showRaw ? raw : {}} fieldErrors={wantsPreview ? parsed.fieldErrors : {}} />
          </CardContent>
        </Card>
        <LawfulUsePanel />
      </div>

      {preview && parsed.segment ? (
        <section aria-labelledby="preview" className="space-y-4" data-testid="segment-preview">
          <div>
            <h2 id="preview" className="text-lg font-semibold">
              Preview
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="preview-headline">
              {preview.summary.listed.toLocaleString("en-GB")} {preview.summary.listed === 1 ? "company" : "companies"} would be listed
              {preview.summary.eligibleCompanies > preview.summary.listed ? ` (of ${preview.summary.eligibleCompanies.toLocaleString("en-GB")} that pass every rule)` : ""}. {describeSegment(parsed.segment)}.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Who was left out</CardTitle>
                <CardDescription>Counted in addresses, not companies.</CardDescription>
              </CardHeader>
              <CardContent>
                <ExclusionSummary summary={preview.summary} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create campaign</CardTitle>
                <CardDescription>Stores this list with a link code per company. The list is built again when you press the button, so a number may differ by one or two.</CardDescription>
              </CardHeader>
              <CardContent>
                {preview.summary.listed === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody in this segment can be listed. Widen the segment, or see the counts on the left.</p>
                ) : (
                  <form action={createCampaignAction} className="space-y-4" data-testid="create-campaign-form">
                    <input type="hidden" name="segment" value={JSON.stringify(parsed.segment)} />
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-name">Name</Label>
                      <Input id="campaign-name" name="name" required minLength={3} maxLength={80} defaultValue={`${today} · ${describeSegment(parsed.segment).split(" · ")[0]!.slice(0, 60)}`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-variant">Subject line</Label>
                      <NativeSelect id="campaign-variant" name="templateVariant" defaultValue={variants[0]?.key} className="w-full">
                        {variants.map((variant) => (
                          <option key={variant.key} value={variant.key}>
                            {variant.label}
                          </option>
                        ))}
                      </NativeSelect>
                      <p className="text-xs text-muted-foreground">To compare two subject lines, make two campaigns: a company is never on two lists.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="campaign-notes">Notes (optional)</Label>
                      <Textarea id="campaign-notes" name="notes" rows={2} maxLength={2000} />
                    </div>
                    <Button type="submit">Create campaign</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {preview.rows.length > 0 ? (
            <div className="rounded-lg border" data-testid="preview-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Town</TableHead>
                    <TableHead>Latest award</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.supplierId} data-testid="preview-row">
                      <TableCell className="whitespace-normal">
                        <Link href={`/suppliers/${row.slug}`} className="font-medium underline-offset-4 hover:underline" prefetch={false}>
                          {row.company}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.legalForm}
                          {row.companyNumber ? (
                            <>
                              {" · "}
                              <a className="underline underline-offset-4" href={`https://find-and-update.company-information.service.gov.uk/company/${row.companyNumber}`} rel="noreferrer">
                                {row.companyNumber}
                              </a>
                            </>
                          ) : null}
                        </p>
                      </TableCell>
                      <TableCell>{row.town ?? "—"}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        <span className="font-medium">{row.award.title}</span>
                        <p className="text-xs text-muted-foreground">
                          {row.award.buyer}
                          {row.award.value ? ` · ${row.award.value}` : ""} · {row.award.date}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.emailKind === "named" ? "secondary" : "outline"}>{row.emailKind === "named" ? "Named address" : "Generic mailbox"}</Badge>
                        {row.domainCheck === "unknown" ? <p className="mt-1 text-xs text-muted-foreground">no website in the notice to check the domain</p> : null}
                      </TableCell>
                      <TableCell>{row.contactBy ? shortDate(row.contactBy) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="campaigns" className="space-y-3">
        <h2 id="campaigns" className="text-lg font-semibold">
          Campaigns
        </h2>
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No campaigns yet. Build a segment above and preview it.</p>
        ) : (
          <div className="rounded-lg border" data-testid="campaign-list">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Listed</TableHead>
                  <TableHead className="text-right">Exported</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opted out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/admin/outreach/campaigns/${campaign.id}`} className="font-medium underline-offset-4 hover:underline">
                        {campaign.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{campaign.segmentText}</p>
                    </TableCell>
                    <TableCell>{day(campaign.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.counts.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.exportedAt ? day(campaign.exportedAt) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.counts.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{campaign.counts.optedOut}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FunnelPanel results={results} title="Results, all campaigns" />
    </div>
  );
}
