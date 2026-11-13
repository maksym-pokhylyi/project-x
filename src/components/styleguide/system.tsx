import { Form } from "@/components/forms/form";
import { Field, FieldGroup, FormField, FormRow, FormRowAction } from "@/components/forms/form-field";
import { IdentityLine } from "@/components/marketing/identity-line";
import { Code, Group, GuideSection, Row, Snippet, Specimen } from "@/components/styleguide/parts";
import { DropZoneDemo, FileButtonDemo, IconButtonDemo, MenuButtonDemo, SegmentedToggleDemo } from "@/components/styleguide/system-demos";
import { ActionList, ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ControlGroup } from "@/components/ui/control-group";
import { CopyField } from "@/components/ui/copy-field";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { DetailList } from "@/components/ui/detail-list";
import { Disclosure } from "@/components/ui/disclosure";
import { Dot } from "@/components/ui/dot";
import { AlertCircleIcon, ArrowDownIcon, ArrowRightIcon, CardIcon, ChevronDownIcon, DashIcon, InfoCircleIcon, ScrollSidewaysIcon, SearchIcon, TickIcon, TickSmallIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { LockedList, LockedRow } from "@/components/ui/locked-list";
import { NativeSelect } from "@/components/ui/native-select";
import { NavLink } from "@/components/ui/nav-link";
import { NoticeBand } from "@/components/ui/notice-band";
import { ReferenceChip } from "@/components/ui/reference-chip";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { StepTracker } from "@/components/ui/step-tracker";
import { tabListClasses } from "@/components/ui/tab-classes";
import { TabsCount } from "@/components/ui/tabs";
import { UpgradeBand } from "@/components/ui/upgrade-band";
import { UsageBar } from "@/components/ui/usage-bar";
import { BID_PASS_DISPLAY, planPrice } from "@/config/plan-display";

/*
 * Sections of the styleguide for the parts added with the second design batch: the control
 * scale, links and menus as actions, "where you are", figures and facts, sources, plans and
 * limits, long jobs, and how to put a screen together. Server components; the few demos that
 * need state are in system-demos.tsx.
 */

/** Contents entries for these sections, in page order (merged into the page's list). */
export const systemNav = [
  ["compose", "Composing a screen"],
  ["control-sizes", "Control sizes"],
  ["actions", "Links, icons and menus"],
  ["where-you-are", "Where you are"],
  ["figures", "Figures and facts"],
  ["sources", "Sources and deadlines"],
  ["plans", "Plans and limits"],
  ["jobs", "Uploads and long jobs"],
] as const;

export function ComposeSection() {
  return (
    <GuideSection
      id="compose"
      title="Composing a screen"
      lead="A screen is put together from the parts on this page, in this order. If a part is missing, add it to src/components/ui and show it here; do not style it in the feature."
    >
      <ol className="grid gap-x-8 gap-y-5 text-sm text-ink sm:grid-cols-2">
        {[
          ["1 · Frame", "Public pages sit in the site header and footer; app pages in the top bar, in a 1280 px container. Bands that state a condition of the whole page (trial, test mode, a payment problem) go directly under the bar: NoticeBand."],
          ["2 · Title", "One h1 per page: type-page in the app (PageHeader), type-h1 on public pages. A meta line in mono above it if the page has one; the page's one green button at its right."],
          ["3 · Where you are", "Sections of the app in the top bar, sections of a page as link tabs, steps as a StepTracker. Every one of them through NavLink or Tabs: never a hand-made current state."],
          ["4 · Content in cards", "White cards with a hairline edge on the paper ground, 24 px apart. Inside: a serif card title, then lists divided by hairlines, a Table, a StatRow or a DetailList. No card inside a card except an 8 px inset panel."],
          ["5 · Controls", "Say the size once on the group: toolbars and tables 44 px (the default), a <Form> 48 px (52 on phones), a search row 52 px. A control that navigates is a ButtonLink, one that acts is a Button, an icon alone is an IconButton."],
          ["6 · States", "Every list has its empty state (EmptyState: one sentence, one action), its loading state (SkeletonRows) and its error (Alert). Limits are said with UsageBar; what a higher plan adds, once, with an UpgradeBand."],
          ["7 · Words", "British English, sentence case, no exclamation marks. Dates as 27 Nov 2026; money rounded in text and exact in tables; a deadline always through DeadlineMarker; a quote always with its ReferenceChip."],
          ["8 · Check", "pnpm ui:audit (no bypass of the library), node scripts/design/controls.mjs with your URLs (sizes, pointer, where you are), keyboard through the page once, then 390, 768 and 1280 px."],
        ].map(([title, text]) => (
          <li key={title}>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-2">{text}</p>
          </li>
        ))}
      </ol>
      <Snippet>{`<PageHeader title="Documents" description="What your answers are drafted from." actions={<Button>Upload</Button>} />
<Card>
  <CardHeader><CardTitle>Certificates</CardTitle></CardHeader>
  <CardContent>
    <ControlGroup size="sm" className="flex gap-2">      {/* a toolbar: field and button both 44 px */}
      <Input type="search" placeholder="Search documents" />
      <Button variant="outline">Search</Button>
    </ControlGroup>
    {loading ? <SkeletonRows rows={4} label="Loading documents" /> : <Table>…</Table>}
  </CardContent>
</Card>`}</Snippet>
    </GuideSection>
  );
}

export function ControlSizesSection() {
  return (
    <GuideSection
      id="control-sizes"
      title="Control sizes"
      lead="Inputs and buttons share one scale of three heights: 44 px in app toolbars, tables and filters, 48 px in forms, 52 px for search rows and forms on a phone. Never mix two heights in one row. A button beside an input takes the input’s height, and a form’s submit button takes the height of its fields. Text inside is 15 px at 44 and 16 px at 48 and 52."
    >
      <Group title="The three heights" note="You do not size the field and the button: you say the size once on the group around them, and both take it.">
        <div className="flex max-w-xl flex-col gap-4">
          <div className="flex items-center gap-4">
            <ControlGroup size="sm" className="flex flex-1 gap-2">
              <Input aria-label="Search documents" placeholder="Search documents" />
              <Button variant="outline">Upload</Button>
            </ControlGroup>
            <span className="type-ref w-24 shrink-0 text-ink-2">44 · app</span>
          </div>
          <div className="flex items-center gap-4">
            <ControlGroup size="md" className="flex flex-1 gap-2">
              <Input aria-label="Work email" placeholder="Work email" />
              <Button>Send</Button>
            </ControlGroup>
            <span className="type-ref w-24 shrink-0 text-ink-2">48 · forms</span>
          </div>
          <div className="flex items-center gap-4">
            <ControlGroup size="lg" className="flex flex-1 gap-2">
              <Input aria-label="Company name or number" placeholder="Company name or number" />
              <Button>Search</Button>
            </ControlGroup>
            <span className="type-ref w-24 shrink-0 text-ink-2">52 · search</span>
          </div>
        </div>
      </Group>
      <Group
        title="A form"
        note={
          <>
            <Code>&lt;Form&gt;</Code> is a form on the scale: 48 px, 52 px on phones, fields 16 px apart. A row of fields with its button is a <Code>FormRow</Code>; the button goes in{" "}
            <Code>FormRowAction</Code>, which mirrors a field (label line, gap, control), so it lines up by construction, also when a field shows an error. A select or any other control gets its
            label from <Code>Field</Code>; a label over something that is not one field from <Code>FieldGroup</Code>.
          </>
        }
      >
        <Form className="max-w-2xl" aria-label="Invite a teammate (sample)">
          <FormRow>
            <div className="min-w-0 flex-1">
              <FormField label="Email address" name="sg-invite-email" type="email" placeholder="colleague@company.com" error="Enter a valid email address." />
            </div>
            <Field label="Role" htmlFor="sg-invite-role">
              <NativeSelect id="sg-invite-role" defaultValue="member" className="w-full sm:w-36">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </NativeSelect>
            </Field>
            <FormRowAction>
              <Button type="button">Send invitation</Button>
            </FormRowAction>
          </FormRow>
          <FieldGroup id="sg-logo" label="Logo" hint="PNG, JPEG or WebP, up to 1 MB.">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-12 place-items-center rounded-card bg-brand-tint text-lg font-semibold text-brand">
                A
              </span>
              <FileButtonDemo />
            </div>
          </FieldGroup>
        </Form>
      </Group>
      <Group title="Size names" note="The same words on Button, ButtonLink, Input, NativeSelect, the Select trigger and ControlGroup. A control with no size takes its group’s; outside any group it is 44 px.">
        <Row>
          <Specimen label="sm · 44 px · compact 14 px label: row and toolbar actions">
            <Button size="sm" variant="outline">
              Confirm
            </Button>
          </Specimen>
          <Specimen label="(none) · 44 px on its own">
            <Button variant="outline">Export to Word</Button>
          </Specimen>
          <Specimen label="md · 48 px">
            <Button size="md" variant="outline">
              Save changes
            </Button>
          </Specimen>
          <Specimen label="lg · 52 px">
            <Button size="lg" variant="outline">
              Find my company
            </Button>
          </Specimen>
          <Specimen label="form · 52 px on phones, 48 px from 640 px">
            <Button size="form">Get a free bid check</Button>
          </Specimen>
        </Row>
        <p className="mt-4 max-w-[42.5rem] text-sm text-ink-2">
          Nothing is shorter than 44 px: the old 36 px <Code>sm</Code> and 28 px <Code>xs</Code> are gone (<Code>xs</Code> remains as an alias of <Code>sm</Code>). The only exceptions are
          controls set inside a line of text (a source mark, a reference chip, a tooltip word), tick boxes and switches (with a 40 px hit area), and a button whose label wraps on a phone.{" "}
          <Code>node scripts/design/controls.mjs</Code> checks every page.
        </p>
      </Group>
      <Group title="Copy field" note="A read-only value with its Copy button: one row on the form scale. The value can always be selected by hand.">
        <CopyField className="max-w-xl" label="Workspace ID" value="Va3PgnOGBohj5UEkO9v9zPVPozA7eeFm" hint="Identifies this workspace. Quote it when you write to support." />
      </Group>
      <Group title="Segmented toggle" note="A few named states of one view (Monthly | Annual). Buttons with aria-pressed, on the control scale.">
        <SegmentedToggleDemo />
      </Group>
    </GuideSection>
  );
}

const buttonLinkVariants = ["default", "outline", "secondary", "ghost", "link"] as const;

export function ActionsSection() {
  return (
    <GuideSection
      id="actions"
      title="Links, icons and menus"
      lead="A control that navigates is a ButtonLink; a control that does something on the page is a Button. Never put button classes on a link by hand, and never nest a link in a Button. Everything clickable shows the pointer cursor; what is disabled does not."
    >
      <Group title="ButtonLink: variants" note="The Button’s variants and sizes on a real link: it opens in a new tab on demand and is announced as a link. Internal addresses go through next/link; a download or an external address is a plain anchor.">
        <Row>
          {buttonLinkVariants.map((variant) => (
            <Specimen key={variant} label={variant}>
              <ButtonLink href="#actions" variant={variant}>
                {variant === "default" ? "Start a bid check" : variant === "link" ? "Original notice" : "See plans"}
              </ButtonLink>
            </Specimen>
          ))}
          <Specimen label="newTab">
            <ButtonLink href="https://www.find-tender.service.gov.uk/" newTab variant="outline">
              Open on Find a Tender
            </ButtonLink>
          </Specimen>
          <Specimen label="download">
            <ButtonLink href="#actions" download variant="outline">
              Export data
            </ButtonLink>
          </Specimen>
          <Specimen label="disabled">
            <ButtonLink href="#actions" disabled>
              Start a bid check
            </ButtonLink>
          </Specimen>
        </Row>
      </Group>
      <Group title="ButtonLink: sizes">
        <Row>
          <Specimen label="sm · 44 px, compact">
            <ButtonLink href="#actions" size="sm" variant="outline">
              View the page
            </ButtonLink>
          </Specimen>
          <Specimen label="(none) · 44 px">
            <ButtonLink href="#actions">See Radar Pro</ButtonLink>
          </Specimen>
          <Specimen label="md · 48 px">
            <ButtonLink href="#actions" size="md">
              Continue
            </ButtonLink>
          </Specimen>
          <Specimen label="lg · 52 px">
            <ButtonLink href="#actions" size="lg">
              Find your company
            </ButtonLink>
          </Specimen>
          <Specimen label="form · 52 → 48 px">
            <ButtonLink href="#actions" size="form">
              Get a free bid check
            </ButtonLink>
          </Specimen>
        </Row>
      </Group>
      <Group title="Destructive steps" note="The way into a step that cannot be undone is quiet: white with a red label. The one filled red button is in the dialog, beside the sentence that says what is lost.">
        <Row>
          <Specimen label="destructive-outline · on the page">
            <Button variant="destructive-outline">Delete workspace</Button>
          </Specimen>
          <Specimen label="destructive · in the confirmation">
            <Button variant="destructive">Delete workspace permanently</Button>
          </Specimen>
        </Row>
      </Group>
      <Group title="Icon button" note="An icon alone: 44 px square on the control scale, with a required label. Ghost by default; round for the avatar.">
        <IconButtonDemo />
      </Group>
      <Group
        title="Menu button and the menu’s call to action"
        note="The quiet trigger of a menu in a bar: muted 14 px text and a chevron. Inside a menu, the one call to action is an item with variant “cta” (brand fill), never a Button dropped into the list. Open it."
      >
        <MenuButtonDemo />
      </Group>
      <Group title="Icons" note="The few signs the artboards draw, as components (src/components/ui/icons.tsx): 1.8 px strokes, round caps, currentColor. Decorative by default; give one a label and it becomes an image with that name.">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-ink">
          {[
            ["TickIcon", <TickIcon key="i" />],
            ["TickSmallIcon", <TickSmallIcon key="i" />],
            ["DashIcon", <DashIcon key="i" />],
            ["ArrowRightIcon", <ArrowRightIcon key="i" />],
            ["ArrowDownIcon", <ArrowDownIcon key="i" />],
            ["ChevronDownIcon", <ChevronDownIcon key="i" />],
            ["SearchIcon", <SearchIcon key="i" />],
            ["ScrollSidewaysIcon", <ScrollSidewaysIcon key="i" />],
            ["AlertCircleIcon", <AlertCircleIcon key="i" />],
            ["InfoCircleIcon", <InfoCircleIcon key="i" />],
            ["CardIcon", <CardIcon key="i" />],
          ].map(([name, icon]) => (
            <span key={name as string} className="inline-flex items-center gap-2">
              {icon}
              <span className="type-ref text-ink-2">{name}</span>
            </span>
          ))}
        </div>
      </Group>
      <Group title="Action row" note="A setting said in a sentence with the one thing to do about it. On phones the action moves under the text, full width.">
        <div className="max-w-3xl rounded-card border border-line bg-surface p-6">
          <ActionList>
            <ActionRow
              title="Export this workspace"
              description="Download everything stored for this workspace as one JSON file."
              action={
                <ButtonLink href="#actions" download variant="outline">
                  Export data
                </ButtonLink>
              }
            />
            <ActionRow title="Delete this workspace" description="Permanently removes the workspace, its members, files and all of its data." action={<Button variant="destructive-outline">Delete workspace</Button>} />
          </ActionList>
        </div>
      </Group>
    </GuideSection>
  );
}

export function WhereYouAreSection() {
  return (
    <GuideSection
      id="where-you-are"
      title="Where you are"
      lead="In every navigation the current item is obvious at a glance: it differs in colour and in weight, and carries a rule or a dot. Never a line alone. NavLink works it out from the address and sets aria-current; no navigation styles its own current state."
    >
      <Group title="bar" note="The app and admin top bars: the current section is ink and semibold with a 2 px ink rule on the bar’s edge; the others are muted.">
        <nav aria-label="Sample bar" className="flex items-stretch gap-7 border-b border-line bg-surface px-5">
          <NavLink href="/styleguide" variant="bar">
            Radar
          </NavLink>
          <NavLink href="/app/bids" variant="bar">
            Bids
          </NavLink>
          <NavLink href="/app/library" variant="bar">
            Documents
          </NavLink>
        </nav>
      </Group>
      <Group title="tab" note="Sections that are separate pages, under a title: the look of the Tabs primitive on real links. Counts are small mono figures.">
        <nav aria-label="Sample tabs" className={tabListClasses}>
          <NavLink href="/styleguide" variant="tab">
            Matches <TabsCount>14</TabsCount>
          </NavLink>
          <NavLink href="/styleguide/ending" variant="tab">
            Ending soon <TabsCount>4</TabsCount>
          </NavLink>
          <NavLink href="/styleguide/buyers" variant="tab">
            Buyers <TabsCount>5</TabsCount>
          </NavLink>
        </nav>
      </Group>
      <Group title="header" note="The public site header: every link is ink; the current one is semibold with a 2 px ink underline.">
        <nav aria-label="Sample header" className="flex items-center gap-8">
          <NavLink href="/styleguide" variant="header">
            Pricing
          </NavLink>
          <NavLink href="/free-bid-check" variant="header">
            Free bid check
          </NavLink>
          <NavLink href="/about-the-data" variant="header">
            About the data
          </NavLink>
        </nav>
      </Group>
      <Group title="menu" note="Stacked lists and the phone menu: 52 px rows; the current one is semibold with an ink dot at the end of the row.">
        <nav aria-label="Sample menu" className="max-w-sm">
          <ul className="divide-y divide-line border-y border-line">
            <li>
              <NavLink href="/styleguide" variant="menu">
                Radar
              </NavLink>
            </li>
            <li>
              <NavLink href="/app/bids" variant="menu">
                Bids
              </NavLink>
            </li>
            <li>
              <NavLink href="/app/library" variant="menu">
                Documents
              </NavLink>
            </li>
          </ul>
        </nav>
      </Group>
      <Snippet>{`<NavLink href="/app/bids" match={(path) => path.startsWith("/app/bids")}>Bids</NavLink>      // a section that spans several paths
<NavLink href="?tab=buyers" variant="tab" current={tab === "buyers"}>Buyers</NavLink>          // "current" lives outside the path`}</Snippet>
    </GuideSection>
  );
}

export function FiguresSection() {
  return (
    <GuideSection id="figures" title="Figures and facts" lead="Numbers a person scans for. Lining, tabular figures; a figure that is not known is a dash or words, never a zero.">
      <Group
        title="Stat row"
        note="A few figures side by side, each a serif numeral over a muted label. Every tile keeps 16 px or more between its text and a divider on both sides, and labels wrap instead of touching. Three frames and three sizes; the spacing is the component’s, never the call site’s."
      >
        <div className="flex flex-col gap-6">
          <Specimen label='frame="card" size="lg" · the supplier summary: two per row on phones, then as many as fit' className="items-stretch">
            <StatRow frame="card" size="lg">
              <Stat value="14" label="public contracts won since 2021" />
              <Stat value="£6.4m" label="total awarded value" />
              <Stat value="9" label="public buyers" />
              <Stat value="4" label="open tenders like your past work" />
            </StatRow>
          </Specimen>
          <Specimen label='frame="rules" · inside a card, flush with the text around it (the claim card on phones, the landing sample)' className="items-stretch">
            <div className="max-w-md rounded-card border border-line bg-surface p-5">
              <p className="font-display text-22 leading-[1.2] font-semibold text-ink">Aldermoor &amp; Pike Building Services Ltd</p>
              <p className="mt-1 text-13 text-ink-2">Wakefield · Companies House 99104652</p>
              <StatRow frame="rules" className="mt-3.5">
                <Stat value="14" label="contracts" />
                <Stat value="£6.4m" label="awarded" />
                <Stat value="9" label="public buyers" />
              </StatRow>
            </div>
          </Specimen>
          <Specimen label='frame="aside" · beside a title from 768 px, every tile led by a hairline; "rules" on phones' className="items-stretch">
            <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 md:flex-row md:items-center md:justify-between md:p-7">
              <div className="min-w-0">
                <p className="font-display text-22 leading-[1.2] font-semibold text-ink md:text-26">Aldermoor &amp; Pike Building Services Ltd</p>
                <p className="mt-1 text-sm text-ink-2">Wakefield · Companies House 99104652</p>
              </div>
              <StatRow frame="aside">
                <Stat value="14" label="contracts" />
                <Stat value="£6.4m" label="awarded" />
                <Stat value="9" label="public buyers" />
              </StatRow>
            </div>
          </Specimen>
          <Specimen label="with a hint under the label, four per row (the admin overview)" className="items-stretch">
            <StatRow frame="card" columns={4}>
              <Stat value="128" label="Sign-ups" hint="14 in 7 days · 52 in 30 days" />
              <Stat value="£2,235" label="MRR (estimate)" hint="Catalogue prices, before tax" />
              <Stat value="31%" label="Trial to paid" hint="9 of 29 trials" />
              <Stat value="—" label="Churned (30 days)" hint="Nothing to report" />
            </StatRow>
          </Specimen>
        </div>
      </Group>
      <Group title="Detail list" note="Facts as “term — value” lines divided by hairlines: the checkout confirmation, a subscription. Long ids break anywhere.">
        <DetailList
          className="max-w-xl"
          rows={[
            { term: "Plan", value: "Bid Desk" },
            { term: "Price", value: "£149 a month" },
            { term: "Trial ends", value: "27 Nov 2026" },
            { term: "First payment", value: "£149 + VAT on 27 Nov 2026" },
          ]}
        />
      </Group>
      <Group title="Usage bar" note="What is counted, “2 of 3 used”, and an 8 px ink bar. The words carry the number; a note can follow (the rollover line). Without a count: words only, no bar.">
        <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
          <UsageBar label="Full bids" used={2} limit={3}>
            <p className="flex items-baseline gap-2 text-13 leading-[1.5] text-ink">
              <Dot />
              <span>
                1 unused bid rolled over from October: <span className="font-semibold text-accent-ink">use it by 30 Nov 2026</span>
              </span>
            </p>
          </UsageBar>
          <UsageBar label="Seats" used={2} limit={3} />
          <UsageBar label="Full bids" value="None">
            <p className="text-13 leading-[1.5] text-ink-2">Free has no full bids. {BID_PASS_DISPLAY.shortLine}</p>
          </UsageBar>
        </div>
      </Group>
    </GuideSection>
  );
}

export function SourcesSection() {
  return (
    <GuideSection id="sources" title="Sources and deadlines" lead="A quote is never shown without where it comes from, and a date that matters is never shown without how long is left.">
      <Group
        title="Reference chip: the three states"
        note="Every reference to the buyer’s pack carries one. The signs differ in form, not only in colour, and are named for assistive technology. On a white card the chip is paper; on paper or a tint it is white (surface)."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {(
            [
              ["verified", "Vol 2 Specification.pdf", "31", "Verified.", "The quote matches the file word for word."],
              ["check", "Vol 4 Pricing Schedule.xlsx", "“Rates” row 6", "Check.", "Found on the page, but not an exact match. Read it yourself."],
              ["unverified", "Draft contract.pdf", "27", "Unverified.", "Could not be matched to the file, for example on a scanned page."],
            ] as const
          ).map(([state, file, page, lead, text]) => (
            <div key={state} className="flex flex-col items-start gap-1.5">
              <ReferenceChip state={state} surface="white" file={file} page={page} />
              <p className="text-13 leading-[1.5] text-ink">
                <span className="font-semibold">{lead}</span> {text}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-5">
          <ReferenceChip state="verified" file="Vol 2 Specification.pdf" page="31" clause="§7.4.2" href="#sources" />
          <ReferenceChip owner="Yours" file="KPI report Q4 2025-26.pdf" page="3" />
          <span className="type-ref text-ink-2">on a white card: paper fill · a link when it opens the page · the supplier’s own document has no state</span>
        </div>
      </Group>
      <Group title="Deadline marker" note="An amber dot, the date in amber ink semibold, the time left on amber tint. Amber marks; amber ink writes. The Dot is also used on its own before a few words that carry a date.">
        <Row>
          <Specimen label="md">
            <DeadlineMarker left="14 days left">Closes 27 Nov 2026</DeadlineMarker>
          </Specimen>
          <Specimen label="sm">
            <DeadlineMarker size="sm" left="20 days left">
              Closes 3 Dec 2026
            </DeadlineMarker>
          </Specimen>
          <Specimen label="lg">
            <DeadlineMarker size="lg" left="14 days left">
              27 Nov 2026, 12:00 noon
            </DeadlineMarker>
          </Specimen>
          <Specimen label="closed">
            <DeadlineMarker closed>Closed 3 Nov 2026</DeadlineMarker>
          </Specimen>
          <Specimen label="Dot">
            <span className="inline-flex items-center gap-2 text-sm text-ink">
              <Dot /> Trial <span className="font-semibold text-accent-ink">9 days left</span>
            </span>
          </Specimen>
        </Row>
      </Group>
    </GuideSection>
  );
}

export function PlansSection() {
  const radarPro = planPrice("starter", "month");
  return (
    <GuideSection
      id="plans"
      title="Plans and limits"
      lead="A limit is stated where it applies, once, with what the next plan adds and what it costs. Nothing is blurred, nothing blocks the work, and prices come from src/config/plans.ts."
    >
      <Group title="Upgrade band" note="A brand-tint band: the fact as a serif line, one sentence, the price, ONE green action (a ButtonLink to /pricing or to the Billing hand-off).">
        <UpgradeBand title="4 more matches are waiting" price={{ amount: radarPro.amount, period: radarPro.period }} action={<ButtonLink href="/pricing">See Radar Pro</ButtonLink>}>
          The free radar shows your top 10 matches. Radar Pro shows every match and sends daily alerts.
        </UpgradeBand>
      </Group>
      <Group title="Locked rows" note="Under the band: what the plan would show, listed honestly. A neutral title, what is fair to give away, and the name of the plan. Rows are not links.">
        <LockedList aria-label="Matches shown with Radar Pro">
          <LockedRow title="Match 11" plan="Radar Pro" meta={<Badge variant="secondary">West Yorkshire</Badge>} deadline={<DeadlineMarker size="sm">Closes 19 Jan 2027</DeadlineMarker>} />
          <LockedRow title="Match 12" plan="Radar Pro" meta={<Badge variant="secondary">South Yorkshire</Badge>} deadline={<DeadlineMarker size="sm">Closes 22 Jan 2027</DeadlineMarker>} />
          <LockedRow title="Match 13" plan="Radar Pro" meta={<Badge variant="secondary">North Yorkshire</Badge>} deadline={<DeadlineMarker size="sm">Closes 2 Feb 2027</DeadlineMarker>} />
        </LockedList>
      </Group>
      <Group
        title="Notice band"
        note="One line across the page, directly under the top bar, for a condition of the whole page: test mode, a payment problem, a seat problem. The lead takes the hue of the tone and the rest is ink. The trial strip is its amber sibling with a dot."
      >
        <div className="flex flex-col gap-3 overflow-hidden rounded-card border border-line">
          <NoticeBand tone="info" containerClassName="px-5">
            <strong className="font-semibold">Test mode.</strong> Payments are simulated and no card is charged.
          </NoticeBand>
          <NoticeBand tone="warning" containerClassName="px-5">
            <strong className="font-semibold">Payment failed.</strong> Paid features stay on until 20 Nov 2026.
          </NoticeBand>
          <NoticeBand tone="danger" containerClassName="px-5">
            <strong className="font-semibold">Uploads are paused.</strong> Storage is not reachable right now.
          </NoticeBand>
        </div>
      </Group>
      <Group title="Identity line" note="Who operates the service, under every public page and in every e-mail. Every word comes from src/config/site.ts.">
        <IdentityLine />
      </Group>
    </GuideSection>
  );
}

export function JobsSection() {
  return (
    <GuideSection id="jobs" title="Uploads and long jobs" lead="Handing files over, and waiting for work that takes minutes. Say what is happening in words, and never show a bar without the stage it stands for.">
      <Group title="Drop zone" note="A paper panel with a dashed line-strong edge. The button is the keyboard and touch way in; dragging files over it turns the edge green.">
        <DropZoneDemo />
      </Group>
      <Group title="Step tracker" note="The stages of a job: done (green ring with a tick), current (heavy ink ring, semibold), waiting (thin muted ring). Side by side from 640 px, a list on phones.">
        <div className="rounded-card border border-line bg-surface p-5 sm:px-7 sm:py-6">
          <p role="status" className="text-15 font-semibold text-ink">
            Building the check <span className="font-normal text-ink-2">· stage 3 of 4</span>
          </p>
          <StepTracker
            className="mt-4"
            steps={[
              { name: "Reading files", state: "done", note: "6 files, 214 pages read · 1 skipped" },
              { name: "Finding requirements", state: "done", note: "23 found" },
              { name: "Listing questions", state: "current", note: "4 found so far" },
              { name: "Checking your company", state: "waiting", note: "Not started" },
            ]}
          />
        </div>
      </Group>
      <Group title="Skeleton rows" note="A list that is still loading, in the shape it will have, inside the same card. Announced once.">
        <div className="max-w-xl rounded-card border border-line bg-surface p-5">
          <SkeletonRows rows={3} label="Loading matches" />
        </div>
      </Group>
      <Group title="Small disclosure" note="A quiet “show more” inside a card (Disclosure size “sm”); the serif question style is for FAQs.">
        <div className="max-w-xl rounded-card border border-line bg-surface px-5 py-2">
          <Disclosure size="sm" summary="1 file was not read">
            <p>Drawings.zip: drawings are skipped. Everything else in the pack was read.</p>
          </Disclosure>
        </div>
      </Group>
    </GuideSection>
  );
}
