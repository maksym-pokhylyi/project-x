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
import { addSuppressionAction, importBouncesAction, removeSuppressionAction, resolveDataRequestAction } from "@/features/outreach/actions";
import { Flash, one, type SearchParams } from "@/features/outreach/components/flash";
import { SUPPRESSION_REASON_LABELS, SUPPRESSION_REASONS } from "@/features/outreach/domain/suppression";
import { listDataRequests } from "@/features/outreach/server/data-requests";
import { listSuppressions } from "@/features/outreach/server/suppressions";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Suppressions" };

const when = (value: Date) => value.toISOString().slice(0, 10);
const SOURCES: Record<string, string> = { optout_link: "opt-out link", optout_form: "opt-out form", admin: "added here", bounce_import: "bounce import" };
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
    <div className="space-y-8">
      <div>
        <Link href="/admin/outreach" className="text-sm text-muted-foreground hover:underline">
          ← Outreach
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Suppressions</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          The do-not-contact list. An address or domain on it is never listed and never exported. It is kept for as long as we send e-mail and is never emptied: it is what stops us writing to someone
          again.
        </p>
        <p className="mt-2 flex flex-wrap gap-2 text-sm" data-testid="suppression-counts">
          <Badge variant="secondary">{list.total.toLocaleString("en-GB")} on the list</Badge>
          {SUPPRESSION_REASONS.filter((reason) => (list.byReason[reason] ?? 0) > 0).map((reason) => (
            <Badge key={reason} variant="outline">
              {SUPPRESSION_REASON_LABELS[reason]}: {(list.byReason[reason] ?? 0).toLocaleString("en-GB")}
            </Badge>
          ))}
        </p>
      </div>

      <Flash params={params} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add an address or a domain</CardTitle>
            <CardDescription>For a “stop” reply, a complaint or a single bounce. A domain covers every address on it — use it when a company says “remove us”.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addSuppressionAction} className="space-y-4" data-testid="add-suppression-form">
              <div className="space-y-1.5">
                <Label htmlFor="suppression-target">Address or domain</Label>
                <Input id="suppression-target" name="target" required maxLength={254} placeholder="name@company.example or company.example" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suppression-reason">Reason</Label>
                <NativeSelect id="suppression-reason" name="reason" defaultValue="optout" className="w-full">
                  {SUPPRESSION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {SUPPRESSION_REASON_LABELS[reason]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suppression-note">Note (optional)</Label>
                <Input id="suppression-note" name="note" maxLength={500} placeholder="e.g. replied “stop” on 15 December" autoComplete="off" />
              </div>
              <Button type="submit">Add to the list</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import a bounce list</CardTitle>
            <CardDescription>Paste addresses, or upload the bounce report as CSV or text. Every address found is added as a bounce; addresses on our own domains are ignored.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importBouncesAction} className="space-y-4" data-testid="import-bounces-form">
              <div className="space-y-1.5">
                <Label htmlFor="bounce-list">Addresses</Label>
                <Textarea id="bounce-list" name="list" rows={4} placeholder={"one address per line"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bounce-file">Or a file (CSV or text, up to 1 MB)</Label>
                <Input id="bounce-file" name="file" type="file" accept=".csv,.txt,text/csv,text/plain" />
              </div>
              <Button type="submit" variant="outline">
                Import bounces
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="list" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="list" className="text-lg font-semibold">
            The list
          </h2>
          <form method="post" action="/admin/outreach/suppressions/export">
            <Button type="submit" variant="outline" size="sm" data-testid="export-suppressions">
              Export CSV
            </Button>
          </form>
        </div>
        <form method="get" className="flex max-w-md gap-2" role="search">
          <label htmlFor="suppression-search" className="sr-only">
            Search the list
          </label>
          <Input id="suppression-search" name="q" defaultValue={query} placeholder="Part of an address or domain" autoComplete="off" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {list.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground" data-testid="suppressions-empty">
            {query ? "Nothing on the list matches that." : "The list is empty."}
          </p>
        ) : (
          <div className="rounded-lg border" data-testid="suppression-table">
            <Table>
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
                    <TableCell className="whitespace-normal">
                      <span className="break-all font-mono text-xs">{row.value}</span>
                      {row.kind === "domain" ? <Badge variant="outline" className="ml-2">whole domain</Badge> : null}
                      {row.note ? <p className="text-xs text-muted-foreground">{row.note}</p> : null}
                    </TableCell>
                    <TableCell>{(SUPPRESSION_REASON_LABELS as Record<string, string>)[row.reason] ?? row.reason}</TableCell>
                    <TableCell>{SOURCES[row.source] ?? row.source}</TableCell>
                    <TableCell>{when(row.createdAt)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <details>
                        <summary className="cursor-pointer text-sm underline underline-offset-4">Remove…</summary>
                        <form action={removeSuppressionAction} className="mt-2 space-y-2" data-testid="remove-suppression-form">
                          <input type="hidden" name="id" value={row.id} />
                          <Label htmlFor={`confirm-${row.id}`} className="text-xs">
                            Removing makes this {row.kind === "domain" ? "domain" : "address"} contactable again. Type it to confirm.
                          </Label>
                          <Input id={`confirm-${row.id}`} name="confirmation" required autoComplete="off" className="h-8 text-xs" />
                          <Button type="submit" variant="destructive" size="sm">
                            Remove from the list
                          </Button>
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
          <p className="flex items-center gap-3 text-sm">
            {list.page > 1 ? (
              <Link href={pageHref(list.page - 1)} className="underline underline-offset-4">
                Newer
              </Link>
            ) : null}
            <span className="text-muted-foreground">
              Page {list.page} of {list.pages} · {list.matching.toLocaleString("en-GB")} entries
            </span>
            {list.page < list.pages ? (
              <Link href={pageHref(list.page + 1)} className="underline underline-offset-4">
                Older
              </Link>
            ) : null}
          </p>
        ) : null}
      </section>

      <section id="requests" aria-labelledby="requests-title" className="scroll-mt-20 space-y-3">
        <h2 id="requests-title" className="text-lg font-semibold">
          Correction and removal requests
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          From the form on “About the data” and from the opt-out page. Act on each within five working days. Hiding a page marks the company as removed: no page, no search result, no outreach.
          Erasing contact details deletes the address everywhere except this list.
        </p>
        {requests.open.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="requests-empty">
            No open requests.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="request-list">
            {requests.open.map((request) => (
              <li key={request.id} className="rounded-lg border bg-card p-4" data-testid="request-row">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {REQUEST_KINDS[request.kind] ?? request.kind}
                    {request.organisationName ? ` · ${request.organisationName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">received {when(request.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{request.message}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Reply to {request.requesterEmail}
                  {request.pageUrl ? ` · ${request.pageUrl}` : ""}
                </p>
                <form action={resolveDataRequestAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={request.id} />
                  {request.supplierSlug ? (
                    <Button type="submit" name="action" value="hide_page" size="sm" variant="outline">
                      Hide the company page
                    </Button>
                  ) : null}
                  <Button type="submit" name="action" value="erase_contact" size="sm" variant="outline">
                    Erase this address’s contact details
                  </Button>
                  <Button type="submit" name="action" value="done" size="sm">
                    Close as done
                  </Button>
                  <Button type="submit" name="action" value="rejected" size="sm" variant="ghost">
                    Close as rejected
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {requests.closed.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Recently closed ({requests.closed.length})</summary>
            <ul className="mt-2 space-y-1 text-muted-foreground">
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
