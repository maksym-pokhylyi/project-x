import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NativeSelect } from "@/components/forms/native-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProspectStatus } from "@/db/schema";
import { discardCampaignAction, markSentAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { ExclusionSummary, FunnelPanel } from "@/features/outreach/components/panels";
import { LETTER_TEMPLATES } from "@/features/outreach/domain/letter";
import { SUPPRESSION_REASON_LABELS } from "@/features/outreach/domain/suppression";
import { getCampaign, getProspectLetter, LETTER_KIND_LABELS, LETTER_KINDS, type CampaignDetail, type ProspectRow } from "@/features/outreach/server/campaigns";
import { getOutreachResults } from "@/features/outreach/server/results";
import { NotFoundError } from "@/lib/errors";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Campaign" };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const date = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "—");

const STATUS_LABELS: Record<ProspectStatus, string> = { listed: "Listed", exported: "Exported", sent: "Sent", opted_out: "Opted out", skipped: "Skipped" };
const STATUS_VARIANTS: Record<ProspectStatus, "default" | "secondary" | "destructive" | "outline"> = { listed: "outline", exported: "secondary", sent: "default", opted_out: "destructive", skipped: "outline" };
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
    <div className="space-y-8">
      <div>
        <Link href="/admin/outreach" className="text-sm text-muted-foreground hover:underline">
          ← Outreach
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="campaign-name">
          {campaign.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {campaign.segmentText} · created {date(campaign.createdAt)} · subject {subjectLabel}
        </p>
        {campaign.notes ? <p className="mt-1 max-w-prose text-sm">{campaign.notes}</p> : null}
      </div>

      <Flash params={query} />

      {detail.senderProblems.length > 0 ? (
        <Alert variant="destructive" data-testid="sender-problems">
          <AlertTitle>Letters cannot be exported yet: sender details are missing</AlertTitle>
          <AlertDescription>
            <p>Every letter must say who is writing. Set these on the deployment (environment variable in brackets), or in src/config/site.ts, and redeploy:</p>
            <ul className="list-disc pl-5">
              {detail.senderProblems.map((problem) => (
                <li key={problem.field}>
                  {problem.label} <span className="font-mono text-xs">[{problem.envVar}]</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {!publicOrigin ? (
        <Alert data-testid="origin-warning">
          <AlertTitle>Links in these letters point to {detail.linkOrigin}</AlertTitle>
          <AlertDescription>That is not the public site. Export from the production deployment before sending anything.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export letters</CardTitle>
            <CardDescription>
              A CSV with one row per letter: address, subject, body and both links. The suppression list and the contact-by dates are checked again at every export; companies already marked as sent
              are not exported twice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" action={`${base}/export`} className="space-y-4" data-testid="export-form">
              <div className="space-y-1.5">
                <Label htmlFor="export-letter">Letter</Label>
                <NativeSelect id="export-letter" name="letter" defaultValue="first" className="w-full">
                  {LETTER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {LETTER_KIND_LABELS[kind]} — {detail.exportable[kind].toLocaleString("en-GB")} to export
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">Reminders go only to companies marked as sent that have not opted out. Take out anyone who replied: replies are in your mailbox, not here.</p>
              </div>
              <Button type="submit" disabled={detail.senderProblems.length > 0} data-testid="export-button">
                Download CSV
              </Button>
              <p className="text-xs text-muted-foreground">
                {campaign.exportedAt ? `Last exported ${date(campaign.exportedAt)}. ` : ""}Each export is logged with your account, the time and the number of rows — not the addresses. Reload this page after
                downloading.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark as sent</CardTitle>
            <CardDescription>The date you sent the first letter is the legal record of first contact. Tick rows in the table below, or take every exported company without a date.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="mark-sent" action={markSentAction} className="space-y-4" data-testid="mark-sent-form">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <div className="space-y-1.5">
                <Label htmlFor="sent-on">Date sent</Label>
                <Input id="sent-on" name="sentOn" type="date" required defaultValue={today} max={today} className="w-44" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" name="scope" value="selected" variant="outline" data-testid="mark-selected">
                  Mark ticked rows as sent
                </Button>
                <Button type="submit" name="scope" value="all_exported" disabled={exportedWithoutDate === 0} data-testid="mark-all-exported">
                  Mark all {exportedWithoutDate.toLocaleString("en-GB")} exported as sent
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <FunnelPanel results={results} title="Results of this campaign" />

      {letter ? (
        <Card id="letter" data-testid="letter-preview">
          <CardHeader>
            <CardTitle>Letter to {letter.company}</CardTitle>
            <CardDescription>
              Variant {letter.variant}. As it would be exported now; details that are not configured yet show in [[double brackets]].{" "}
              <Link href={base} className="underline underline-offset-4">
                Close
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Subject:</span> <span className="font-medium">{letter.subject}</span>
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">{letter.body}</pre>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="prospects" className="space-y-3">
        <h2 id="prospects" className="text-lg font-semibold">
          Companies on this list
        </h2>
        <p className="text-sm text-muted-foreground">
          {campaign.counts.total.toLocaleString("en-GB")} listed · {campaign.counts.sent.toLocaleString("en-GB")} sent · {campaign.counts.optedOut.toLocaleString("en-GB")} opted out ·{" "}
          {campaign.counts.skipped.toLocaleString("en-GB")} skipped. Open a company’s page from here — these links carry no code, so your own look is not counted as a visit.
        </p>
        <div className="rounded-lg border" data-testid="prospect-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Tick to mark as sent</span>
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Award</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Visits</TableHead>
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
                      {canMarkSent(prospect) ? <input type="checkbox" name="ids" value={prospect.id} form="mark-sent" aria-label={`Mark ${prospect.company} as sent`} /> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Link href={`/suppliers/${prospect.slug}`} className="font-medium underline-offset-4 hover:underline" prefetch={false}>
                        {prospect.company}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {prospect.town ?? "—"}
                        {prospect.companyNumber ? (
                          <>
                            {" · "}
                            <a className="underline underline-offset-4" href={`https://find-and-update.company-information.service.gov.uk/company/${prospect.companyNumber}`} rel="noreferrer">
                              {prospect.companyNumber}
                            </a>
                          </>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-sm whitespace-normal">
                      {prospect.award ? (
                        <>
                          <span>{prospect.award.title}</span>
                          <p className="text-xs text-muted-foreground">
                            {prospect.award.buyer}
                            {prospect.award.value ? ` · ${prospect.award.value}` : ""} · {prospect.award.date}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">erased</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {prospect.erased ? (
                        <span className="text-xs text-muted-foreground">erased</span>
                      ) : (
                        <>
                          {prospect.emailKind === "named" ? "Named" : "Generic"}
                          {prospect.contactBy ? <p className="text-xs text-muted-foreground">contact by {date(prospect.contactBy)}</p> : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge variant={STATUS_VARIANTS[prospect.status]}>{STATUS_LABELS[prospect.status]}</Badge>
                      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
                    </TableCell>
                    <TableCell>{date(prospect.sentAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{prospect.visits > 0 ? prospect.visits : "—"}</TableCell>
                    <TableCell>
                      {prospect.award ? (
                        <Link href={`${base}?letter=${prospect.id}#letter`} className="text-sm underline underline-offset-4" prefetch={false}>
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
      </section>

      <Card>
        <CardHeader>
          <CardTitle>How this list was built</CardTitle>
          <CardDescription>Frozen when the campaign was created.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExclusionSummary summary={campaign.buildSummary} />
        </CardContent>
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
