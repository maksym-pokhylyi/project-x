import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ControlGroup } from "@/components/ui/control-group";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLANS, isPlanKey } from "@/config/plans";
import { listAdminOrganizations } from "@/server/admin";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Organizations" };

/** Every workspace, newest first, with a search by name, slug or id. */
export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminForPage();
  const query = (await searchParams).q?.slice(0, 100) ?? "";
  const rows = await listAdminOrganizations(query);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-page text-ink">Organizations</h1>
      <ControlGroup size="sm" asChild>
        <form className="flex max-w-md gap-2" role="search">
          <label htmlFor="org-search" className="sr-only">
            Search organizations
          </label>
          <Input id="org-search" type="search" name="q" defaultValue={query} placeholder="Name, slug or id" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </ControlGroup>
      {rows.length === 0 ? (
        <EmptyState title="No organizations found" description={query ? `Nothing matches “${query}”. Try part of the name, the slug or the id.` : "Workspaces appear here as people sign up."} />
      ) : (
        <Table framed className="min-w-[35rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Members</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/organizations/${row.id}`} className="link font-semibold">
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.planKey && isPlanKey(row.planKey) ? PLANS[row.planKey].name : PLANS.free.name}</TableCell>
                <TableCell>{row.status ? <Badge variant={row.status === "active" ? "success" : row.status === "past_due" ? "destructive" : "secondary"}>{row.status}</Badge> : <span className="text-ink-2">—</span>}</TableCell>
                <TableCell numeric>{row.memberCount}</TableCell>
                <TableCell className="whitespace-nowrap text-ink-2">{row.createdAt.toISOString().slice(0, 10)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
