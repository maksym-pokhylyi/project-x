import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/errors";
import { entitlementsFor } from "@/lib/billing/subscription";
import { getAdminOrganization, monthlyRevenueCents } from "@/server/admin";

export const metadata: Metadata = { title: "Organization" };

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "—");

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAdminOrganization(id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { organization, subscription } = data;
  const entitlements = entitlementsFor(subscription);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/organizations" className="text-sm text-muted-foreground hover:underline">
          ← Organizations
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{organization.name}</h1>
        <p className="break-all text-sm text-muted-foreground">
          {organization.id} · {organization.slug} · created {day(organization.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Effective plan: {entitlements.plan.name} ({entitlements.source})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{subscription.status}</dd>
                <dt className="text-muted-foreground">Plan</dt>
                <dd>
                  {subscription.planKey} · {subscription.billingInterval ?? "—"} · MRR {usd(monthlyRevenueCents(subscription) / 100)}
                </dd>
                <dt className="text-muted-foreground">Period</dt>
                <dd>
                  {day(subscription.currentPeriodStart)} → {day(subscription.currentPeriodEnd)}
                </dd>
                <dt className="text-muted-foreground">Cancel at</dt>
                <dd>{day(subscription.cancelAt)}</dd>
                <dt className="text-muted-foreground">Paddle subscription</dt>
                <dd className="break-all">{subscription.paddleSubscriptionId ?? "—"}</dd>
                <dt className="text-muted-foreground">Paddle customer</dt>
                <dd className="break-all">{subscription.paddleCustomerId ?? "—"}</dd>
                <dt className="text-muted-foreground">Billing e-mail</dt>
                <dd className="break-all">{subscription.customerEmail ?? "—"}</dd>
                <dt className="text-muted-foreground">Last event</dt>
                <dd>{subscription.lastEventAt?.toISOString() ?? "—"}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription: this workspace is on the Free plan.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>AI spend this month: {usd(data.aiSpendMonthUsd)}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.counters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No metered usage yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.counters.map((counter) => (
                  <li key={`${counter.metric}-${counter.periodStart.toISOString()}`} className="flex justify-between py-2">
                    <span>
                      {counter.metric} <span className="text-muted-foreground">({day(counter.periodStart)})</span>
                    </span>
                    <span className="tabular-nums">{counter.quantity.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>{data.members.length} in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.members.map((member) => (
                <li key={member.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{member.name}</span> <span className="break-all text-muted-foreground">{member.email}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{member.role}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Latest 30 entries</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{entry.action}</span> <span className="text-muted-foreground">{entry.target}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{entry.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>Latest 30 analytics events of this workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="font-medium">{event.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{event.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
