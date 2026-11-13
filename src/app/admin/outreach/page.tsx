import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, PageSection } from "@/components/app/page-header";
import { FieldHint } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createCampaignAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { AuditTrail, ExclusionSummary, FunnelPanel, LawfulUsePanel, NamedAddressesNotice } from "@/features/outreach/components/panels";
import { SegmentForm } from "@/features/outreach/components/segment-form";
import { NAMED_ADDRESSES_BLOCKED, outreachConfig, ukRepresentativeAppointed } from "@/features/outreach/config";
import { subjectVariants } from "@/features/outreach/domain/letter";
import { DEFAULT_SEGMENT, describeSegment, segmentFromParams } from "@/features/outreach/domain/segment";
import { previewSegment, type SegmentPreview } from "@/features/outreach/server/builder";
import { listCampaigns, listOutreachAudit } from "@/features/outreach/server/campaigns";
import { getOutreachResults } from "@/features/outreach/server/results";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Outreach" };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const date = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");
const number = (value: number) => value.toLocaleString("en-GB");
const COMPANIES_HOUSE = "https://find-and-update.company-information.service.gov.uk/company/";

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

  // Without a UK representative only generic mailboxes may be listed. The server refuses a
  // named segment anyway; the page says so instead of asking it.
  const namedAllowed = ukRepresentativeAppointed();
  const namedRefused = parsed.segment !== null && parsed.segment.mailbox !== "generic" && !namedAllowed;

  let preview: SegmentPreview | null = null;
  if (wantsPreview && parsed.segment && !namedRefused) preview = await previewSegment(parsed.segment);
  const [campaigns, results, audit] = await Promise.all([listCampaigns(), getOutreachResults(null), listOutreachAudit(20)]);
  const variants = subjectVariants(outreachConfig.defaultTemplateKey);
  const segment = parsed.segment ?? DEFAULT_SEGMENT;
  const today = new Date().toISOString().slice(0, 10);
  const formKey = JSON.stringify([segment, showRaw ? raw : null, namedAllowed]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Outreach"
        description="Build a list of companies that recently won a public contract, export the letters and send them yourself. Nothing here sends e-mail."
        actions={
          <ButtonLink href="/admin/suppressions" variant="outline">
            Suppressions
          </ButtonLink>
        }
      />

      <Flash params={params} />
      {namedAllowed ? null : <NamedAddressesNotice />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Segment</CardTitle>
            <CardDescription>Who to look for. Suppressed addresses, users, companies already written to and anyone the legal gate rejects are always left out.</CardDescription>
          </CardHeader>
          <CardContent>
            <SegmentForm key={formKey} values={segment} raw={showRaw ? raw : {}} fieldErrors={wantsPreview ? parsed.fieldErrors : {}} namedAllowed={namedAllowed} />
          </CardContent>
        </Card>
        <LawfulUsePanel />
      </div>

      {wantsPreview && namedRefused ? (
        <Alert variant="destructive" data-testid="preview-refused">
          <AlertTitle>No preview was built</AlertTitle>
          <AlertDescription>
            <p>That segment asks for named addresses. {NAMED_ADDRESSES_BLOCKED}. Choose generic mailboxes only and preview again.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {preview && parsed.segment ? (
        <PageSection
          title="Preview"
          description={
            <span data-testid="preview-headline">
              {number(preview.summary.listed)} {preview.summary.listed === 1 ? "company" : "companies"} would be listed
              {preview.summary.eligibleCompanies > preview.summary.listed ? ` (of ${number(preview.summary.eligibleCompanies)} that pass every rule)` : ""}. {describeSegment(parsed.segment)}.
            </span>
          }
        >
          <div className="flex flex-col gap-6" data-testid="segment-preview">
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Who was left out</CardTitle>
                  <CardDescription>Counted in addresses, not companies.</CardDescription>
                </CardHeader>
                <ExclusionSummary summary={preview.summary} />
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Create campaign</CardTitle>
                  <CardDescription>Stores this list with a link code per company. The list is built again when you press the button, so a number may differ by one or two.</CardDescription>
                </CardHeader>
                <CardContent>
                  {preview.summary.listed === 0 ? (
                    <p className="text-sm text-ink-2" data-testid="preview-empty">
                      Nobody in this segment can be listed. Widen the segment, or read the counts beside this card.
                    </p>
                  ) : (
                    <form action={createCampaignAction} className="flex flex-col gap-5" data-testid="create-campaign-form">
                      <input type="hidden" name="segment" value={JSON.stringify(parsed.segment)} />
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="campaign-name">Name</Label>
                        <Input
                          id="campaign-name"
                          name="name"
                          required
                          minLength={3}
                          maxLength={80}
                          defaultValue={`${today} · ${describeSegment(parsed.segment).split(" · ")[0]!.slice(0, 60)}`}
                          autoComplete="off"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="campaign-variant">Subject line</Label>
                        <NativeSelect id="campaign-variant" name="templateVariant" defaultValue={variants[0]?.key} className="w-full" aria-describedby="campaign-variant-hint">
                          {variants.map((variant) => (
                            <option key={variant.key} value={variant.key}>
                              {variant.label}
                            </option>
                          ))}
                        </NativeSelect>
                        <FieldHint id="campaign-variant-hint">To compare two subject lines, make two campaigns: a company is never on two lists.</FieldHint>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="campaign-notes">Notes (optional)</Label>
                        <Textarea id="campaign-notes" name="notes" rows={2} maxLength={2000} />
                      </div>
                      <div>
                        <Button type="submit" data-testid="create-campaign-button">
                          Create campaign
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {preview.rows.length > 0 ? (
              <div data-testid="preview-table">
                <Table framed className="min-w-[56rem]" containerClassName="max-h-[40rem]">
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
                        <TableCell>
                          <Link href={`/suppliers/${row.slug}`} className="link font-semibold" prefetch={false}>
                            {row.company}
                          </Link>
                          <p className="mt-0.5 text-13 text-ink-2">
                            {row.legalForm}
                            {row.companyNumber ? (
                              <>
                                {" · "}
                                <a href={`${COMPANIES_HOUSE}${row.companyNumber}`} rel="noreferrer" className="link-ref">
                                  {row.companyNumber}
                                </a>
                              </>
                            ) : null}
                          </p>
                        </TableCell>
                        <TableCell>{row.town ?? "—"}</TableCell>
                        <TableCell className="max-w-md">
                          <span className="font-medium">{row.award.title}</span>
                          <p className="mt-0.5 text-13 text-ink-2">
                            {row.award.buyer}
                            {row.award.value ? ` · ${row.award.value}` : ""} · {row.award.date}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.emailKind === "named" ? "info" : "secondary"}>{row.emailKind === "named" ? "Named address" : "Generic mailbox"}</Badge>
                          {row.domainCheck === "unknown" ? <p className="mt-1 text-13 text-ink-2">No website in the notice to check the domain against.</p> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.contactBy ? <time dateTime={row.contactBy.slice(0, 10)}>{date(row.contactBy)}</time> : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        </PageSection>
      ) : null}

      <PageSection title="Campaigns">
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" description="Build a segment above and preview it. Nothing is stored until you create a campaign." />
        ) : (
          <div data-testid="campaign-list">
            <Table framed className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Exported</TableHead>
                  <TableHead numeric>Listed</TableHead>
                  <TableHead numeric>Sent</TableHead>
                  <TableHead numeric>Opted out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} data-testid="campaign-row">
                    <TableCell>
                      <Link href={`/admin/outreach/campaigns/${campaign.id}`} className="link font-semibold">
                        {campaign.name}
                      </Link>
                      <p className="mt-0.5 text-13 text-ink-2">{campaign.segmentText}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{date(campaign.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{date(campaign.exportedAt)}</TableCell>
                    <TableCell numeric>{number(campaign.counts.total)}</TableCell>
                    <TableCell numeric>{number(campaign.counts.sent)}</TableCell>
                    <TableCell numeric>{number(campaign.counts.optedOut)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageSection>

      <FunnelPanel results={results} title="Results, all campaigns" />

      <PageSection title="Audit trail" description="The last 20 actions in this tool and on the do-not-contact list: who, when and how many — never whom.">
        <AuditTrail rows={audit} />
      </PageSection>
    </div>
  );
}
