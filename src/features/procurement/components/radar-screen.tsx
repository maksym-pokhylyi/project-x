import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { removeRadarSourceAction } from "../actions";
import { cpvDivisionLabel } from "../domain/cpv";
import { pluralise } from "../domain/format";
import { UK_REGIONS } from "../domain/regions";
import { VALUE_BANDS, type RadarTab, type RadarView } from "../radar/view";
import { DataAttribution } from "./data-attribution";
import { BuyerCard, EndingSoonCard } from "./lists";
import { EmptyState, SourceLink } from "./primitives";
import { TenderActions } from "./radar-actions";
import { TenderCard, TenderRow } from "./tender-card";

const TAB_LABELS: Record<RadarTab, string> = { matches: "Matches", ending: "Ending soon", buyers: "Buyers", signals: "Early signals", saved: "Saved" };

function hrefFor(view: RadarView, overrides: Record<string, string | null>): string {
  const params = new URLSearchParams();
  const values: Record<string, string | null> = {
    profile: view.active && view.sources.length > 1 ? view.active.key : null,
    tab: view.tab === "matches" ? null : view.tab,
    division: view.filters.division,
    region: view.filters.region,
    value: view.filters.value,
    kind: view.filters.kind,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/app?${query}` : "/app";
}

/** Inline, never a modal trap: what is locked, what the plan includes, one button. */
export function UpgradeNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="upgrade-notice">
      <div className="flex items-start gap-3">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
        <Link href="/app/settings/billing">See plans</Link>
      </Button>
    </aside>
  );
}

/** No company linked yet: the two ways to set up a radar. */
export function RadarOnboarding() {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="radar-onboarding">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">Find your company</h2>
        <p className="mt-1 text-sm text-muted-foreground">If you have won a public contract, your radar is ready: we build it from your published awards.</p>
        <form action="/app/radar/find" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row" role="search">
          <label htmlFor="radar-find" className="sr-only">
            Company name or Companies House number
          </label>
          <Input id="radar-find" name="q" type="search" placeholder="Company name or number" />
          <Button type="submit">Search</Button>
        </form>
      </section>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">We haven&apos;t won public contracts yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us your trades, regions and a few keywords. You will see matching tenders, contracts ending soon and the buyers in your trade.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/app/radar/setup">Set up a radar manually</Link>
        </Button>
      </section>
    </div>
  );
}

function Tabs({ view }: { view: RadarView }) {
  return (
    <nav aria-label="Radar sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {(Object.keys(TAB_LABELS) as RadarTab[]).map((tab) => {
          const active = view.tab === tab;
          return (
            <li key={tab}>
              <Link
                href={hrefFor(view, { tab: tab === "matches" ? null : tab })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                data-testid={`radar-tab-${tab}`}
              >
                {TAB_LABELS[tab]}
                {tab === "saved" && view.saved.length > 0 ? <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{view.saved.length}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Filters({ view }: { view: RadarView }) {
  if (view.tab === "saved" || !view.spec) return null;
  const divisions = view.spec.cpvDivisions;
  const showMatchFilters = view.tab === "matches" || view.tab === "signals";
  return (
    <form action="/app" method="get" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end" aria-label="Filters" data-testid="radar-filters">
      {view.active && view.sources.length > 1 ? <input type="hidden" name="profile" value={view.active.key} /> : null}
      {view.tab !== "matches" ? <input type="hidden" name="tab" value={view.tab} /> : null}
      {showMatchFilters && divisions.length > 1 ? (
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Trade
          <NativeSelect name="division" defaultValue={view.filters.division ?? ""} className="w-full sm:min-w-44">
            <option value="">All your trades</option>
            {divisions.map((division) => (
              <option key={division} value={division}>
                {cpvDivisionLabel(division)}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Region
        <NativeSelect name="region" defaultValue={view.filters.region ?? ""} className="w-full sm:min-w-40">
          <option value="">Anywhere</option>
          {Object.entries(UK_REGIONS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {showMatchFilters ? (
        <>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
            Value
            <NativeSelect name="value" defaultValue={view.filters.value ?? ""} className="w-full sm:min-w-36">
              <option value="">Any value</option>
              {Object.entries(VALUE_BANDS).map(([key, band]) => (
                <option key={key} value={key}>
                  {band.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          {view.tab === "matches" ? (
            <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
              Notice type
              <NativeSelect name="kind" defaultValue={view.filters.kind ?? ""} className="w-full sm:min-w-40">
                <option value="">Any type</option>
                <option value="tender">Tender (above threshold)</option>
                <option value="below_threshold">Below-threshold</option>
                <option value="framework">Framework</option>
              </NativeSelect>
            </label>
          ) : null}
        </>
      ) : null}
      <div className="col-span-2 flex gap-2">
        <Button type="submit" variant="outline" size="sm" className="min-h-10 sm:min-h-9">
          Apply
        </Button>
        {view.hasFilters ? (
          <Button asChild variant="ghost" size="sm" className="min-h-10 sm:min-h-9">
            <Link href={hrefFor(view, { division: null, region: null, value: null, kind: null })}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FilteredEmpty({ view, title }: { view: RadarView; title: string }) {
  return (
    <EmptyState
      title={view.hasFilters ? "Nothing matches these filters" : title}
      action={
        view.hasFilters ? (
          <Button asChild variant="outline">
            <Link href={hrefFor(view, { division: null, region: null, value: null, kind: null })}>Clear filters</Link>
          </Button>
        ) : undefined
      }
    >
      {view.hasFilters ? "Try a wider region or value range." : "New notices are checked against your radar every ten minutes."}
    </EmptyState>
  );
}

function List({ view, now }: { view: RadarView; now: Date }) {
  const list = view.list;
  if (!list) return null;
  if (list.tab === "saved") {
    return list.items.length > 0 ? (
      <div className="rounded-lg border bg-card px-4">
        {list.items.map((item) => (
          <TenderRow key={item.ocid} item={item} href={`/app/tenders/${item.ocid}`} now={now} trailing={<TenderActions ocid={item.ocid} state="saved" canBid={item.stage === "tender"} />} />
        ))}
      </div>
    ) : (
      <EmptyState title="No saved tenders yet">Save a tender from Matches to keep its deadline in view here.</EmptyState>
    );
  }
  if (list.tab === "matches" || list.tab === "signals") {
    if (list.items.length === 0) {
      return <FilteredEmpty view={view} title={list.tab === "matches" ? "No open tenders match your radar right now" : "No early notices match your radar right now"} />;
    }
    const lockedTotal = Math.max(0, list.total - list.items.length);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid="radar-count">
          {list.tab === "matches" ? pluralise(list.total, "open tender") : pluralise(list.total, "early notice")} for {view.active?.name}
          {view.hasFilters ? " with these filters" : ""}
        </p>
        <div className="grid gap-3 xl:grid-cols-2">
          {list.items.map((item) => (
            <TenderCard
              key={item.ocid}
              item={item}
              href={`/app/tenders/${item.ocid}`}
              now={now}
              actions={<TenderActions ocid={item.ocid} state={view.states.get(item.ocid) ?? null} canBid={list.tab === "matches"} />}
            />
          ))}
        </div>
        {lockedTotal > 0 ? (
          <div className="space-y-3" data-testid="radar-locked">
            <UpgradeNotice title={`${pluralise(lockedTotal, "more match", "more matches")} on Radar Pro`}>
              The Free plan shows your top {view.access.matchLimit} matches with reasons and deadlines. Radar Pro shows every match, daily alerts and five profiles.
            </UpgradeNotice>
            <ul className="divide-y rounded-lg border bg-card">
              {list.locked.map((item) => (
                <li key={item.ocid} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="locked-row">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.buyerName ?? "Buyer not stated"} · match reason, deadline tracking and saving are part of Radar Pro</p>
                  </div>
                  <SourceLink href={item.noticeUrl} className="shrink-0" />
                </li>
              ))}
            </ul>
            {lockedTotal > list.locked.length ? <p className="text-xs text-muted-foreground">and {lockedTotal - list.locked.length} more.</p> : null}
          </div>
        ) : null}
      </div>
    );
  }
  if (list.tab === "ending") {
    if (list.items.length === 0) return <FilteredEmpty view={view} title="No contracts in your trade have a published end date in the next nine months" />;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {pluralise(list.total, "contract")} in your trade with an end date in the next nine months. Buyers usually publish the next tender before then.
        </p>
        <div className="grid gap-3 xl:grid-cols-2">
          {list.items.map((item) => (
            <EndingSoonCard key={`${item.ocid}:${item.supplierId}`} item={item} now={now} />
          ))}
        </div>
        {list.hidden > 0 ? (
          <UpgradeNotice title={`${pluralise(list.hidden, "more contract")} on Radar Pro`}>The Free plan shows the {list.items.length} closest to your trade and region.</UpgradeNotice>
        ) : null}
      </div>
    );
  }
  if (list.tab !== "buyers") return null;
  if (list.items.length === 0) return <FilteredEmpty view={view} title="No awards in your trade have been published in the last 24 months" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{pluralise(list.total, "buyer")} awarded contracts in your trade in the last 24 months. Nearby buyers come first.</p>
      <div className="grid gap-3 xl:grid-cols-2">
        {list.items.map((item) => (
          <BuyerCard key={item.buyerId} item={item} />
        ))}
      </div>
      {list.hidden > 0 ? <UpgradeNotice title={`${pluralise(list.hidden, "more buyer")} on Radar Pro`}>The Free plan shows the {list.items.length} most active near you.</UpgradeNotice> : null}
    </div>
  );
}

export function RadarScreen({ view, now, justClaimed, canManage }: { view: RadarView; now: Date; justClaimed: boolean; canManage: boolean }) {
  const active = view.active;
  return (
    <div className="space-y-6" data-testid="radar">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Radar</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="radar-source">
            {active ? (
              active.kind === "supplier" ? (
                <>
                  Built from the published awards of{" "}
                  <Link href={`/suppliers/${active.slug}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {active.name}
                  </Link>
                </>
              ) : (
                <>Built from your radar profile “{active.name}”</>
              )
            ) : (
              "Open tenders, contracts ending soon and buyers in your trade."
            )}
          </p>
        </div>
        {active ? (
          <div className="flex flex-wrap items-center gap-2">
            {active.kind === "manual" ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/radar/setup?profile=${active.profileId}`}>Edit profile</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/app/radar/find">Add a company</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {justClaimed && active ? (
        <div role="status" className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm" data-testid="radar-first-run">
          <p className="font-medium">Your radar is ready.</p>
          <p className="mt-0.5 text-muted-foreground">
            {active.kind === "supplier" ? `We built it from ${pluralise(active.awardsCount, "published award")} of ${active.name}.` : "We built it from your profile."} Save the
            tenders worth a closer look; we keep their deadlines in view.
          </p>
        </div>
      ) : null}

      {view.sources.length > 1 ? (
        <nav aria-label="Radar profiles" className="flex flex-wrap gap-2">
          {view.sources.map((source) => (
            <Link
              key={source.key}
              href={hrefFor(view, { profile: source.key, division: null })}
              aria-current={source.key === active?.key ? "true" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm", source.key === active?.key ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {source.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {view.deadlines.length > 0 ? (
        <section aria-labelledby="deadlines" className="rounded-lg border bg-card px-4 py-3" data-testid="radar-deadlines">
          <h2 id="deadlines" className="text-sm font-semibold">
            Upcoming deadlines <span className="font-normal text-muted-foreground">· saved tenders closing within 14 days</span>
          </h2>
          <div className="mt-1">
            {view.deadlines.slice(0, 5).map((item) => (
              <TenderRow key={item.ocid} item={item} href={`/app/tenders/${item.ocid}`} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {view.sources.length === 0 && view.tab !== "saved" ? (
        <RadarOnboarding />
      ) : (
        <>
          <Tabs view={view} />
          {active && !view.spec && view.tab !== "saved" ? (
            <EmptyState
              title={`${active.name} has no published awards we can build a radar from`}
              action={
                <Button asChild variant="outline">
                  <Link href="/app/radar/setup">Describe your trade instead</Link>
                </Button>
              }
            >
              Its awards may have been cancelled or withdrawn. You can set up the radar manually.
            </EmptyState>
          ) : (
            <>
              <Filters view={view} />
              <List view={view} now={now} />
            </>
          )}
        </>
      )}

      {active && canManage ? (
        <form action={removeRadarSourceAction} className="border-t pt-4 text-xs text-muted-foreground">
          <input type="hidden" name="key" value={active.key} />
          Not the right {active.kind === "supplier" ? "company" : "profile"}?{" "}
          <button type="submit" className="font-medium underline underline-offset-4 hover:text-foreground">
            Remove {active.name} from this radar
          </button>
        </form>
      ) : null}

      <DataAttribution />
    </div>
  );
}

export function RadarError() {
  return (
    <div className="space-y-4" data-testid="radar-error">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Radar</h1>
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <p className="font-medium">We could not load your radar.</p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing is lost: your saved tenders and profiles are safe. This is usually temporary.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/app">Try again</Link>
        </Button>
      </div>
    </div>
  );
}
