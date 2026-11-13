import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PageSection } from "@/components/app/page-header";
import { FieldHint } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RETENTION_DAYS } from "@/config/retention";
import type { ProspectStatus } from "@/db/schema";
import { clearSentAction, discardCampaignAction, markSentAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { ExclusionSummary, FunnelPanel, OutreachCrumbs } from "@/features/outreach/components/panels";
import { LETTER_TEMPLATES } from "@/features/outreach/domain/letter";
import { SUPPRESSION_REASON_LABELS } from "@/features/outreach/domain/suppression";
import { getCampaign, getProspectLetter, LETTER_KIND_LABELS, LETTER_KINDS, type CampaignDetail, type ProspectRow } from "@/features/outreach/server/campaigns";
import { getOutreachResults } from "@/features/outreach/server/results";
import { NotFoundError } from "@/lib/errors";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Campaign" };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const date = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");
const number = (value: number) => value.toLocaleString("en-GB");
const COMPANIES_HOUSE = "https://find-and-update.company-information.service.gov.uk/company/";

const STATUS_LABELS: Record<ProspectStatus, string> = { listed: "Listed", exported: "Exported", sent: "Sent", opted_out: "Opted out", skipped: "Skipped" };
const STATUS_VARIANTS: Record<ProspectStatus, "outline" | "secondary" | "success" | "destructive"> = {
  listed: "outline",
  exported: "secondary",
  sent: "success",
  opted_out: "destructive",
  skipped: "outline",
};
const SKIPPED_REASONS: Record<string, string> = { suppressed: "on the do-not-contact list", contact_window_expired: "past its contact-by date" };

function statusNote(prospect: ProspectRow): string | null {
  if (prospect.status === "skipped") return SKIPPED_REASONS[prospect.skippedReason ?? ""] ?? null;
  if (prospect.suppressedNow && prospect.status !== "opted_out") {
    return `suppressed: ${(SUPPRESSION_REASON_LABELS as Record<string, string>)[prospect.suppressedNow]?.toLowerCase() ?? prospect.suppressedNow}`;
  }
  if (prospect.status === "opted_out" && !prospect.sentAt) return "before a send date was recorded";
  return null;
}

/** May this row be ticked for "mark as sent"? Mirrors the rule in markProspectsSent. */
const canMarkSent = (prospect: ProspectRow) => !prospect.sentAt && (prospect.status === "listed" || prospect.status === "exported" || (prospect.status === "opted_out" && prospect.exportedAt !== null));

/**
 * Founder only. One campaign: export the letters, record what was sent, read the results.
 * The table shows companies, never addresses — those are only in the exported file.
 */
export default async function AdminCampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdminForPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const detail: CampaignDetail = await getCampaign(id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const letterId = one(query.letter);
  const [results, letter] = await Promise.all([getOutreachResults(id), letterId ? getProspectLetter(id, letterId) : Promise.resolve(null)]);
  const { campaign, prospects } = detail;
  const subjectLabel = LETTER_TEMPLATES[campaign.templateKey]?.subjects[campaign.templateVariant]?.label ?? campaign.templateVariant;
  const today = new Date().toISOString().slice(0, 10);
  const exportedWithoutDate = prospects.filter((prospect) => prospect.exportedAt && canMarkSent(prospect)).length;
  const publicOrigin = detail.linkOrigin.startsWith("https://");
  const base = `/admin/outreach/campaigns/${campaign.id}`;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3.5" data-testid="campaign-header">
        <OutreachCrumbs current={campaign.name} />
        <PageHeader
          title={campaign.name}
          eyebrow={`Campaign · created ${date(campaign.createdAt)} · ${number(campaign.counts.total)} ${campaign.counts.total === 1 ? "company" : "companies"}`}
          description={
            <>
              {campaign.segmentText}. Subject line: {subjectLabel}.{campaign.notes ? <span className="mt-1 block text-ink">{campaign.notes}</span> : null}
            </>
          }
        />
      </div>

      <Flash params={query} />

      {detail.senderProblems.length > 0 ? (
        <Alert variant="destructive" data-testid="sender-problems">
          <AlertTitle>Letters cannot be exported yet: sender details are missing</AlertTitle>
          <AlertDescription>
            <p>Every letter must say who is writing. Still missing:</p>
            <ul className="list-disc pl-5">
              {detail.senderProblems.map((problem) => (
                <li key={problem.field}>
                  {problem.label} <span className="type-ref text-ink-2">({problem.where})</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {publicOrigin ? null : (
        <Alert variant="warning" role="note" data-testid="origin-warning">
          <AlertTitle>Links in these letters point to {detail.linkOrigin}</AlertTitle>
          <AlertDescription>
            <p>That is not the public site. Export from the production deployment before sending anything.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export letters</CardTitle>
            <CardDescription>
              A CSV with one row per letter: address, subject, body and both links. The suppression list and the contact-by dates are checked again at every export; companies already marked as sent
              are not exported twice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action={`${base}/export`} className="flex flex-col gap-5" data-testid="export-form">
              <div className="flex flex-col gap-2">
                <Label htmlFor="export-letter">Letter</Label>
                <NativeSelect id="export-letter" name="letter" defaultValue="first" className="w-full" aria-describedby="export-letter-hint">
                  {LETTER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {LETTER_KIND_LABELS[kind]} — {number(detail.exportable[kind])} to export
                    </option>
                  ))}
                </NativeSelect>
                <FieldHint id="export-letter-hint">Reminders go only to companies marked as sent that have not opted out. Take out anyone who replied: replies are in your mailbox, not here.</FieldHint>
              </div>
              <div>
                <Button type="submit" disabled={detail.senderProblems.length > 0} data-testid="export-button">
                  Download CSV
                </Button>
              </div>
              <FieldHint>
                {campaign.exportedAt ? `Last exported ${date(campaign.exportedAt)}. ` : ""}Each export is logged with your account, the time and the number of rows — not the addresses. Reload this page
                after downloading.
              </FieldHint>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark as sent</CardTitle>
            <CardDescription>The date you sent the first letter is the legal record of first contact. Mark each day’s batch on the day you send it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="mark-sent" action={markSentAction} className="flex flex-col gap-5" data-testid="mark-sent-form">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <div className="flex flex-col gap-2">
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sent-on">Date sent</Label>
                    <Input id="sent-on" name="sentOn" type="date" required defaultValue={today} max={today} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sent-count">How many, in list order</Label>
                    <Input
                      id="sent-count"
                      name="count"
                      type="number"
                      min={1}
                      max={Math.max(1, exportedWithoutDate)}
                      inputMode="numeric"
                      placeholder={exportedWithoutDate > 0 ? `up to ${number(exportedWithoutDate)}` : "nothing exported yet"}
                      aria-describedby="sent-count-hint"
                    />
                  </div>
                </div>
                <FieldHint id="sent-count-hint">
                  {number(exportedWithoutDate)} exported {exportedWithoutDate === 1 ? "company has" : "companies have"} no date yet. List order is the order of the table below and of the exported
                  file. Or tick rows in the table.
                </FieldHint>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Button type="submit" name="scope" value="first_exported" disabled={exportedWithoutDate === 0} data-testid="mark-first-exported">
                  Mark that many as sent
                </Button>
                <Button type="submit" name="scope" value="selected" variant="outline" data-testid="mark-selected">
                  Mark ticked rows as sent
                </Button>
              </div>
              <Disclosure variant="inline" summary="Marked the wrong rows, or the wrong day?">
                <p className="text-ink-2">Tick those rows in the table and clear their date. They can then be marked again. The correction is logged.</p>
                <div>
                  <Button type="submit" formAction={clearSentAction} formNoValidate variant="outline" data-testid="clear-sent">
                    Clear the sent date of ticked rows
                  </Button>
                </div>
              </Disclosure>
            </form>
          </CardContent>
        </Card>
      </div>

      <FunnelPanel results={results} title="Results of this campaign" />

      {letter ? (
        <Card id="letter" className="scroll-mt-6" data-testid="letter-preview">
          <CardHeader>
            <CardTitle>Letter to {letter.company}</CardTitle>
            <CardDescription>Variant {letter.variant}, as it would be exported now. A detail that is not configured yet shows in [[double brackets]].</CardDescription>
            <CardAction>
              <ButtonLink href={base} variant="outline" size="sm" prefetch={false}>
                Close
              </ButtonLink>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              <span className="text-ink-2">Subject:</span> <span className="font-semibold">{letter.subject}</span>
            </p>
            <pre className="overflow-x-auto rounded-control border border-line bg-paper p-4 font-mono text-13 whitespace-pre-wrap text-ink">{letter.body}</pre>
          </CardContent>
        </Card>
      ) : null}

      <PageSection
        title="Companies on this list"
        description={
          <>
            {number(campaign.counts.total)} listed · {number(campaign.counts.sent)} sent · {number(campaign.counts.optedOut)} opted out · {number(campaign.counts.skipped)} skipped. The links to
            company pages carry no code, so your own look is not counted as a visit. Addresses are erased {RETENTION_DAYS.outreachProspects} days after the campaign was created (a named address{" "}
            {RETENTION_DAYS.outreachNamedAddresses} days after sending); the counts stay.
          </>
        }
      >
        <div data-testid="prospect-table">
          <Table framed className="min-w-[64rem]" containerClassName="max-h-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-11">
                  <span className="sr-only">Tick</span>
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Award</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead numeric>Visits</TableHead>
                <TableHead>
                  <span className="sr-only">Letter</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((prospect) => {
                const note = statusNote(prospect);
                return (
                  <TableRow key={prospect.id} data-testid="prospect-row" data-status={prospect.status}>
                    <TableCell>
                      {canMarkSent(prospect) || prospect.sentAt ? (
                        <Checkbox name="ids" value={prospect.id} form="mark-sent" aria-label={`Tick ${prospect.company}`} data-testid="prospect-tick" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link href={`/suppliers/${prospect.slug}`} className="link font-semibold" prefetch={false}>
                        {prospect.company}
                      </Link>
                      <p className="mt-0.5 text-13 text-ink-2">
                        {prospect.town ?? "—"}
                        {prospect.companyNumber ? (
                          <>
                            {" · "}
                            <a href={`${COMPANIES_HOUSE}${prospect.companyNumber}`} rel="noreferrer" className="link-ref">
                              {prospect.companyNumber}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      {prospect.award ? (
                        <>
                          <span>{prospect.award.title}</span>
                          <p className="mt-0.5 text-13 text-ink-2">
                            {prospect.award.buyer}
                            {prospect.award.value ? ` · ${prospect.award.value}` : ""} · {prospect.award.date}
                          </p>
                        </>
                      ) : (
                        <span className="text-ink-2">Erased</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {prospect.erased ? (
                        <span className="text-ink-2">Erased</span>
                      ) : (
                        <>
                          {prospect.emailKind === "named" ? "Named" : "Generic"}
                          {prospect.contactBy ? <p className="mt-0.5 text-13 whitespace-nowrap text-ink-2">contact by {date(prospect.contactBy)}</p> : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[prospect.status]}>
                        {prospect.status === "sent" ? <Check aria-hidden strokeWidth={2.5} /> : null}
                        {STATUS_LABELS[prospect.status]}
                      </Badge>
                      {note ? <p className="mt-1 text-13 text-ink-2">{note}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{date(prospect.sentAt)}</TableCell>
                    <TableCell numeric>{prospect.visits > 0 ? number(prospect.visits) : "—"}</TableCell>
                    <TableCell>
                      {prospect.award ? (
                        <Link href={`${base}?letter=${prospect.id}#letter`} className="link" prefetch={false} data-testid="letter-link">
                          Letter
                        </Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <Card>
        <CardHeader>
          <CardTitle>How this list was built</CardTitle>
          <CardDescription>Frozen when the campaign was created.</CardDescription>
        </CardHeader>
        <ExclusionSummary summary={campaign.buildSummary} />
      </Card>

      {detail.canDiscard ? (
        <Card>
          <CardHeader>
            <CardTitle>Discard this campaign</CardTitle>
            <CardDescription>Nothing has been exported or sent, so this list can be deleted. Its companies can then be listed again.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={discardCampaignAction}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <Button type="submit" variant="destructive" data-testid="discard-campaign">
                Discard campaign
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
