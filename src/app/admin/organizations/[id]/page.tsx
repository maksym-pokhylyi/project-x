import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList } from "@/components/ui/detail-list";
import { formatPrice } from "@/config/plans";
import { entitlementsFor } from "@/lib/billing/subscription";
import { NotFoundError } from "@/lib/errors";
import { getAdminOrganization, monthlyRevenueCents } from "@/server/admin";
import { requireAdminForPage } from "@/server/session";

export const metadata: Metadata = { title: "Organization" };

/** AI spend is an estimated cost in US dollars; revenue is in the catalogue's pounds. */
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : "—");
const minute = (date: Date) => date.toISOString().replace("T", " ").slice(0, 16);

const list = "divide-y divide-line text-sm";
const row = "flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0";
const empty = "text-sm text-ink-2";

/** One workspace as the founder sees it: its subscription as Paddle reported it, usage, people and the latest records. */
export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminForPage();
  const { id } = await params;
  const data = await getAdminOrganization(id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { organization, subscription } = data;
  const entitlements = entitlementsFor(subscription);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/admin/organizations" className="link inline-flex min-h-11 items-center self-start text-sm text-ink-2">
          All organizations
        </Link>
        <h1 className="type-page text-ink">{organization.name}</h1>
        <p className="text-sm break-all text-ink-2">
          <span className="font-mono text-13">{organization.id}</span> · {organization.slug} · created {day(organization.createdAt)}
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
              <DetailList
                framed={false}
                rows={[
                  { term: "Status", value: subscription.status },
                  { term: "Plan", value: `${subscription.planKey} · ${subscription.billingInterval ?? "—"} · MRR ${formatPrice(monthlyRevenueCents(subscription))}` },
                  { term: "Period", value: `${day(subscription.currentPeriodStart)} to ${day(subscription.currentPeriodEnd)}` },
                  { term: "Cancel at", value: day(subscription.cancelAt) },
                  { term: "Subscription ID", value: subscription.paddleSubscriptionId ?? "—" },
                  { term: "Customer ID", value: subscription.paddleCustomerId ?? "—" },
                  { term: "Billing email", value: subscription.customerEmail ?? "—" },
                  { term: "Last event", value: subscription.lastEventAt?.toISOString() ?? "—" },
                ]}
              />
            ) : (
              <p className={empty}>No subscription: this workspace is on the Free plan.</p>
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
              <p className={empty}>No metered usage yet.</p>
            ) : (
              <ul className={list}>
                {data.counters.map((counter) => (
                  <li key={`${counter.metric}-${counter.periodStart.toISOString()}`} className={row}>
                    <span>
                      {counter.metric} <span className="text-ink-2">({day(counter.periodStart)})</span>
                    </span>
                    <span className="tabular-nums">{counter.quantity.toLocaleString("en-GB")}</span>
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
            <ul className={list}>
              {data.members.map((member) => (
                <li key={member.id} className={row}>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{member.name}</span> <span className="break-all text-ink-2">{member.email}</span>
                  </span>
                  <span className="shrink-0 text-ink-2">{member.role}</span>
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
              <p className={empty}>Nothing recorded.</p>
            ) : (
              <ul className={list}>
                {data.recentAudit.map((entry) => (
                  <li key={entry.id} className={row}>
                    <span className="min-w-0 break-words">
                      <span className="font-semibold text-ink">{entry.action}</span> <span className="text-ink-2">{entry.target}</span>
                    </span>
                    <span className="shrink-0 text-13 text-ink-2 tabular-nums">{minute(entry.createdAt)}</span>
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
            <p className={empty}>No events yet.</p>
          ) : (
            <ul className={list}>
              {data.recentEvents.map((event) => (
                <li key={event.id} className={row}>
                  <span className="font-semibold text-ink">{event.name}</span>
                  <span className="shrink-0 text-13 text-ink-2 tabular-nums">{minute(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
