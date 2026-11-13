import type { Metadata } from "next";
import { EmptyState, PageHeader, PageSection } from "@/components/app/page-header";
import { FieldHint } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { addSuppressionAction, importBouncesAction, removeSuppressionAction, resolveDataRequestAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { DisclosureChevron as Chevron, OutreachCrumbs } from "@/features/outreach/components/panels";
import { SUPPRESSION_REASON_LABELS, SUPPRESSION_REASONS } from "@/features/outreach/domain/suppression";
import { listDataRequests } from "@/features/outreach/server/data-requests";
import { listSuppressions } from "@/features/outreach/server/suppressions";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Suppressions" };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const when = (value: Date) => DATE.format(value);
const number = (value: number) => value.toLocaleString("en-GB");
const SOURCES: Record<string, string> = { optout_link: "Opt-out link", optout_form: "Opt-out form", admin: "Added here", bounce_import: "Bounce import" };
const REQUEST_KINDS: Record<string, string> = { correction: "Correction", removal: "Removal", other: "Other" };

/**
 * Founder only. The do-not-contact list: every address or domain here is left out when a
 * list is built and again when it is exported. Also the queue of correction and removal
 * requests, which have a five-working-day deadline.
 */
export default async function AdminSuppressionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminForPage();
  const params = await searchParams;
  const query = one(params.q).slice(0, 120);
  const page = Number(one(params.page)) || 1;
  const [list, requests] = await Promise.all([listSuppressions({ query, page }), listDataRequests()]);
  const pageHref = (target: number) => `/admin/outreach/suppressions?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) }).toString()}`;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3.5">
        <OutreachCrumbs current="Suppressions" />
        <PageHeader
          title="Suppressions"
          description="The do-not-contact list. An address or domain on it is never listed and never exported. It is kept for as long as we send e-mail and is never emptied: it is what stops us writing to someone again."
          meta={
            <span className="flex flex-wrap gap-2" data-testid="suppression-counts">
              <Badge variant="secondary">{number(list.total)} on the list</Badge>
              {SUPPRESSION_REASONS.filter((reason) => (list.byReason[reason] ?? 0) > 0).map((reason) => (
                <Badge key={reason} variant="outline">
                  {SUPPRESSION_REASON_LABELS[reason]}: {number(list.byReason[reason] ?? 0)}
                </Badge>
              ))}
            </span>
          }
        />
      </div>

      <Flash params={params} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add an address or a domain</CardTitle>
            <CardDescription>For a “stop” reply, a complaint or a single bounce. A domain covers every address on it: use it when a company says “remove us”.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addSuppressionAction} className="flex flex-col gap-5" data-testid="add-suppression-form">
              <div className="flex flex-col gap-2">
                <Label htmlFor="suppression-target">Address or domain</Label>
                <Input id="suppression-target" name="target" required maxLength={254} placeholder="name@company.example or company.example" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="suppression-reason">Reason</Label>
                <NativeSelect id="suppression-reason" name="reason" defaultValue="optout" className="w-full">
                  {SUPPRESSION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {SUPPRESSION_REASON_LABELS[reason]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="suppression-note">Note (optional)</Label>
                <Input id="suppression-note" name="note" maxLength={500} placeholder="e.g. replied “stop” on 15 December" autoComplete="off" aria-describedby="suppression-note-hint" />
                <FieldHint id="suppression-note-hint">Do not copy an e-mail address or a person’s name into the note.</FieldHint>
              </div>
              <div>
                <Button type="submit" data-testid="add-suppression-button">
                  Add to the list
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import a bounce list</CardTitle>
            <CardDescription>Paste addresses, or upload the bounce report as CSV or text. Every address found is added as a bounce; addresses on our own domains are ignored.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importBouncesAction} className="flex flex-col gap-5" data-testid="import-bounces-form">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bounce-list">Addresses</Label>
                <Textarea id="bounce-list" name="list" rows={4} placeholder="one address per line" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bounce-file">Or a file (CSV or text, up to 1 MB)</Label>
                <Input id="bounce-file" name="file" type="file" accept=".csv,.txt,text/csv,text/plain" />
              </div>
              <div>
                <Button type="submit" variant="outline" data-testid="import-bounces-button">
                  Import bounces
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <PageSection
        title="The list"
        description={query ? `${number(list.matching)} of ${number(list.total)} ${list.total === 1 ? "entry matches" : "entries match"} “${query}”.` : undefined}
        action={
          <form method="post" action="/admin/outreach/suppressions/export">
            <Button type="submit" variant="outline" data-testid="export-suppressions">
              Export CSV
            </Button>
          </form>
        }
      >
        <form method="get" className="flex max-w-md gap-2" role="search">
          <label htmlFor="suppression-search" className="sr-only">
            Search the list
          </label>
          <Input id="suppression-search" name="q" type="search" defaultValue={query} placeholder="Part of an address or domain" autoComplete="off" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {list.rows.length === 0 ? (
          <div data-testid="suppressions-empty">
            <EmptyState
              title={query ? "Nothing on the list matches that" : "The list is empty"}
              description={query ? "Check the spelling, or search for the domain alone." : "Opt-outs, bounces and complaints appear here as they come in."}
            />
          </div>
        ) : (
          <div data-testid="suppression-table">
            <Table framed className="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Address or domain</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((row) => (
                  <TableRow key={row.id} data-testid="suppression-row" data-kind={row.kind}>
                    <TableCell>
                      <span className="font-mono text-13 [overflow-wrap:anywhere]">{row.value}</span>
                      {row.kind === "domain" ? (
                        <Badge variant="outline" className="ml-2 align-middle">
                          Whole domain
                        </Badge>
                      ) : null}
                      {row.note ? <p className="mt-0.5 text-13 text-ink-2">{row.note}</p> : null}
                    </TableCell>
                    <TableCell>{(SUPPRESSION_REASON_LABELS as Record<string, string>)[row.reason] ?? row.reason}</TableCell>
                    <TableCell>{SOURCES[row.source] ?? row.source}</TableCell>
                    <TableCell className="whitespace-nowrap">{when(row.createdAt)}</TableCell>
                    <TableCell className="w-72">
                      <details className="group">
                        <summary className="link inline-flex min-h-6 items-center gap-1 rounded-sm">
                          Remove
                          <Chevron />
                        </summary>
                        <form action={removeSuppressionAction} className="mt-3 flex flex-col gap-2" data-testid="remove-suppression-form">
                          <input type="hidden" name="id" value={row.id} />
                          <Label htmlFor={`confirm-${row.id}`}>Type the {row.kind === "domain" ? "domain" : "address"} to confirm</Label>
                          <Input id={`confirm-${row.id}`} name="confirmation" required autoComplete="off" aria-describedby={`confirm-${row.id}-hint`} />
                          <FieldHint id={`confirm-${row.id}-hint`}>Removing it makes this {row.kind === "domain" ? "domain" : "address"} contactable again. The removal is logged.</FieldHint>
                          <div>
                            <Button type="submit" variant="destructive">
                              Remove from the list
                            </Button>
                          </div>
                        </form>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {list.pages > 1 ? (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href={list.page > 1 ? pageHref(list.page - 1) : undefined} disabled={list.page <= 1} />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-ink-2 tabular-nums">
                  Page {list.page} of {list.pages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href={list.page < list.pages ? pageHref(list.page + 1) : undefined} disabled={list.page >= list.pages} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </PageSection>

      <section id="requests" aria-labelledby="requests-title" className="flex scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="requests-title" className="type-section text-ink">
            Correction and removal requests
          </h2>
          <p className="max-w-[42.5rem] text-sm text-ink-2">
            From the request form on “About the data”, which the opt-out page links to. Act on each within five working days and reply to the sender yourself. Hiding a page marks the company as
            removed: no page, no search result, no outreach. Erasing contact details deletes the address everywhere except this list.
          </p>
        </div>
        {requests.open.length === 0 ? (
          <div data-testid="requests-empty">
            <EmptyState title="No open requests" description="A request sent from the public site appears here until you close it." />
          </div>
        ) : (
          <ul className="flex flex-col gap-4" data-testid="request-list">
            {requests.open.map((request) => (
              <li key={request.id} data-testid="request-row">
                <Card className="gap-3 py-5">
                  <CardHeader>
                    <CardTitle className="font-sans text-base">
                      {REQUEST_KINDS[request.kind] ?? request.kind}
                      {request.organisationName ? ` · ${request.organisationName}` : ""}
                    </CardTitle>
                    <CardDescription>Received {when(request.createdAt)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{request.message}</p>
                    <p className="text-13 text-ink-2 [overflow-wrap:anywhere]">
                      Reply to {request.requesterEmail}
                      {request.pageUrl ? ` · ${request.pageUrl}` : ""}
                    </p>
                    <form action={resolveDataRequestAction} className="flex flex-wrap gap-2.5">
                      <input type="hidden" name="id" value={request.id} />
                      {request.supplierSlug ? (
                        <Button type="submit" name="action" value="hide_page" variant="outline">
                          Hide the company page
                        </Button>
                      ) : null}
                      <Button type="submit" name="action" value="erase_contact" variant="outline">
                        Erase this address’s contact details
                      </Button>
                      <Button type="submit" name="action" value="done">
                        Close as done
                      </Button>
                      <Button type="submit" name="action" value="rejected" variant="ghost">
                        Close as rejected
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {requests.closed.length > 0 ? (
          <details className="group text-sm">
            <summary className="link inline-flex min-h-11 items-center gap-1 rounded-sm">
              Recently closed ({requests.closed.length})
              <Chevron />
            </summary>
            <ul className="mt-1 flex flex-col gap-1 text-ink-2">
              {requests.closed.map((request) => (
                <li key={request.id}>
                  {request.resolvedAt ? when(request.resolvedAt) : "—"} · {request.status} · {REQUEST_KINDS[request.kind] ?? request.kind}
                  {request.organisationName ? ` · ${request.organisationName}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
