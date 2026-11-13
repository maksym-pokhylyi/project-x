import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAdminOrganizations } from "@/server/admin";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Organizations" };

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminForPage();
  const query = (await searchParams).q?.slice(0, 100) ?? "";
  const rows = await listAdminOrganizations(query);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      <form className="flex max-w-md gap-2" role="search">
        <label htmlFor="org-search" className="sr-only">
          Search organizations
        </label>
        <Input id="org-search" name="q" defaultValue={query} placeholder="Name, slug or id" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No organizations found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">Name</th>
                <th scope="col" className="p-3 font-medium">Plan</th>
                <th scope="col" className="p-3 font-medium">Status</th>
                <th scope="col" className="p-3 font-medium">Members</th>
                <th scope="col" className="p-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">
                    <Link href={`/admin/organizations/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="p-3">{row.planKey ?? "free"}</td>
                  <td className="p-3">{row.status ?? "—"}</td>
                  <td className="p-3 tabular-nums">{row.memberCount}</td>
                  <td className="p-3 text-muted-foreground">{row.createdAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
