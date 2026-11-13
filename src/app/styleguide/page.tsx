import { ArrowRight, Download, Plus, Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, PageSection } from "@/components/app/page-header";
import { FieldError, FieldHint, FormError, FormField } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Logo, LogoMark, Wordmark } from "@/components/logo";
import { MARK_FAVICON } from "@/components/logo-paths";
import {
  ChoiceDemo,
  CitationPopoverDemo,
  DialogDemo,
  DropdownDemo,
  FilterChipDemo,
  LoadingButtonDemo,
  SelectDemo,
  TabsDemo,
  ToastDemo,
  TooltipDemo,
  WordCountDemo,
} from "@/components/styleguide/demos";
import { Canvas, Code, Group, GuideSection, Row, Snippet, Specimen, Swatch } from "@/components/styleguide/parts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { Disclosure, DisclosureGroup } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { ReferenceChip } from "@/components/ui/reference-chip";
import { ScoreBars } from "@/components/ui/score-bars";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "Bidfolio design system reference: tokens, type scale and every primitive in all its states.",
  robots: { index: false, follow: false },
};

const nav = [
  ["principles", "How to use this"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["layout", "Space, radius, shadow"],
  ["brand", "Brand"],
  ["buttons", "Buttons"],
  ["forms", "Form controls"],
  ["badges", "Badges and chips"],
  ["bid", "Bid components"],
  ["alerts", "Alerts"],
  ["surfaces", "Cards and feedback"],
  ["navigation", "Navigation"],
  ["tables", "Tables"],
  ["overlays", "Overlays"],
  ["patterns", "Page patterns"],
  ["domain", "Domain recipes"],
  ["accessibility", "Accessibility"],
] as const;

const surfaces = [
  { name: "paper", value: "#FAF8F3", use: "Page background", className: "bg-paper", bordered: true },
  { name: "paper-deep", value: "#F2EEE4", use: "Bands, wells, quiet chips, the footer", className: "bg-paper-deep", bordered: true },
  { name: "surface", value: "#FFFFFF", use: "Cards, panels, inputs, the app bar", className: "bg-surface", bordered: true },
];
const inks = [
  { name: "ink", value: "#161A1D", use: "Text. Body copy is ink, not grey · 16.5:1 on paper", className: "bg-ink" },
  { name: "ink-2", value: "#5A6165", use: "Muted text: captions, meta lines, descriptions · 5.9:1 on paper", className: "bg-ink-2" },
];
const lines = [
  { name: "line", value: "#E3DED2", use: "Dividers and card edges only · 1.3:1", className: "bg-line" },
  { name: "line-strong", value: "#857F70", use: "The edge of a control: inputs, tick boxes, outline buttons · 4.0:1", className: "bg-line-strong" },
];
const brand = [
  { name: "brand", value: "#0F5A47", use: "Primary actions, the underline of links, “met” with a tick, the focus ring", className: "bg-brand" },
  { name: "brand-hover", value: "#0B4636", use: "Hover and pressed", className: "bg-brand-hover" },
  { name: "brand-tint", value: "#E6EFEB", use: "Selected rows, the verdict panel, source markers", className: "bg-brand-tint", bordered: true },
  { name: "brand-mark", value: "#D5E6DE", use: "Highlighter on a quoted sentence in a source document", className: "bg-brand-mark", bordered: true },
  { name: "brand-on-dark", value: "#BFE0D3", use: "Secondary text on brand green; the favicon in dark themes", className: "bg-brand-on-dark", bordered: true },
];
const roles = [
  { name: "accent", value: "#B4690E", use: "Amber: markers, rules and large numerals only. Never small text", className: "bg-accent" },
  { name: "accent-ink", value: "#925207", use: "Amber for small text · 5.8:1 on paper", className: "bg-accent-ink" },
  { name: "accent-tint", value: "#F7EBD7", use: "The “14 days left” pill", className: "bg-accent-tint", bordered: true },
  { name: "danger", value: "#A3271C", use: "Errors, gaps", className: "bg-danger" },
  { name: "danger-tint", value: "#F6E3E0", use: "Gap and error panels", className: "bg-danger-tint", bordered: true },
  { name: "success-tint", value: "#E4EFE7", use: "Background of “Met”. The text and tick are brand green: there is no success colour", className: "bg-success-tint", bordered: true },
  { name: "info", value: "#1F4F8F", use: "Neutral labels: notice types, “For you to confirm”. Never links", className: "bg-info" },
  { name: "info-tint", value: "#E3EAF4", use: "Info background", className: "bg-info-tint", bordered: true },
];

const scale = [
  { cls: "text-6xl", role: "type-hero (≥1024 px)", size: "50/54", sample: "Know which contracts", serif: true },
  { cls: "text-5xl", role: "type-h2 (≥1024 px)", size: "40/45", sample: "Every requirement, quoted", serif: true },
  { cls: "text-4xl", role: "type-title · app page title", size: "36/42", sample: "Planned and responsive maintenance", serif: true },
  { cls: "text-3xl", role: "type-section · section heading in a page", size: "28/34", sample: "Pass-or-fail requirements", serif: true },
  { cls: "text-2xl", role: "type-h3 · step and plan names", size: "24/30", sample: "Upload the tender pack", serif: true },
  { cls: "text-xl", role: "Card heading", size: "20/26", sample: "Is this your company?", serif: true },
  { cls: "text-lg", role: "type-lead", size: "18/28", sample: "No summaries to take on trust." },
  { cls: "text-17", role: "Row title, quoted requirement (type-quote)", size: "17/24", sample: "Fire stopping works to six residential blocks", semibold: true },
  { cls: "text-base", role: "Body on public pages (type-reading 16/26)", size: "16/24", sample: "Each line in a check is the buyer’s own sentence." },
  { cls: "text-15", role: "Body in the app, buttons, tabs", size: "15/22", sample: "Calderbrook Metropolitan Borough Council · Tender notice" },
  { cls: "text-sm", role: "Tables, descriptions, labels", size: "14/20", sample: "Each line is quoted word for word from the pack." },
  { cls: "text-13", role: "Status pills, notes", size: "13/20", sample: "No DBS register or certificate dates in any of your 12 documents." },
  { cls: "text-xs", role: "Chips, column heads, mono references", size: "12/16", sample: "public contracts won since 2021" },
] as const;

/** A button-shaped specimen frozen in one state (the real hover and pressed styles, applied statically). */
function StateChip({ className, children }: { className: string; children: string }) {
  return (
    <span className={`inline-flex h-11 items-center justify-center rounded-control border border-transparent px-[1.125rem] text-15 font-semibold ${className}`}>{children}</span>
  );
}

export default function StyleguidePage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="container-content flex min-h-14 items-center gap-4 md:min-h-[4.5rem]">
          <Logo />
          <Badge variant="secondary">Design system</Badge>
          <span className="ml-auto hidden text-13 text-ink-2 md:inline">
            Source of truth: <Code>docs/design/handoff</Code> and <Code>docs/design/DESIGN.md</Code>
          </span>
        </div>
      </header>

      <div className="container-content grid gap-x-12 gap-y-8 py-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-14">
        <nav aria-label="Styleguide sections" className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
          <p className="mb-2 text-sm font-semibold text-ink">Contents</p>
          <ol className="flex flex-wrap gap-x-4 text-sm lg:block">
            {nav.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="link-quiet inline-flex min-h-8 items-center rounded-sm text-ink-2">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main id="main" className="min-w-0 space-y-16">
          <header>
            <p className="type-ref text-ink-2">Bidfolio design system · implements the designer’s artboards of 13 Nov 2026</p>
            <h1 className="type-h1 mt-3 text-ink">Styleguide</h1>
            <p className="type-lead mt-4 max-w-[42.5rem] text-ink">
              Tokens, type and every primitive in all its states. Build feature screens from what is on this page; if something you need is missing, add it to{" "}
              <Code>src/components/ui</Code> and show it here.
            </p>
          </header>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="principles" title="How to use this" lead="Six rules that decide most questions. The reasoning is in DESIGN.md §1.">
            <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {[
                ["Evidence on the page", "Every claim is one click from its source. The reference chip sits next to the quote, never in a tooltip."],
                ["Calm density", "Show a lot, quietly: hierarchy from type and hairlines, not from boxes, colour or shadow."],
                ["Deadlines lead", "Dates get the same marker and the same position in every card and row."],
                ["Honest machine", "Drafts and marks are labelled and editable. Gaps are shown as gaps; a mark is never a forecast."],
                ["Not the government", "Warm paper, ink and deep green; links are ink with a green underline, never blue."],
                ["Works one-handed", "Everything is usable at 360 px with 44 px targets."],
              ].map(([title, body], index) => (
                <li key={title} className="flex flex-col gap-1.5 border-t-2 border-ink pt-4">
                  <p className="font-mono text-13 text-ink-2">{String(index + 1).padStart(2, "0")}</p>
                  <p className="text-17 font-semibold text-ink">{title}</p>
                  <p className="text-15 text-ink">{body}</p>
                </li>
              ))}
            </ol>
            <Alert variant="info" role="note">
              <AlertTitle>Colours come from tokens only</AlertTitle>
              <AlertDescription>
                <p>
                  Use <Code>bg-paper</Code>, <Code>text-ink-2</Code>, <Code>border-line</Code> and the shadcn names (<Code>bg-background</Code>,{" "}
                  <Code>text-muted-foreground</Code>, <Code>bg-primary</Code> …), never a hex value or a Tailwind palette colour. Note that <Code>accent</Code> is the
                  amber role here, not a hover grey: for hover and selected surfaces use <Code>bg-paper-deep</Code> or <Code>bg-brand-tint</Code>.
                </p>
              </AlertDescription>
            </Alert>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="colour"
            title="Colour"
            lead={
              <>
                The designer’s nine colours, with the shades derived from them. Each token is a utility for background, text and border: <Code>bg-brand</Code>,{" "}
                <Code>text-brand</Code>, <Code>border-brand</Code>. Contrast of every pair in use is computed by <Code>node scripts/design/contrast.mjs</Code> and listed
                in <Code>docs/design/CONTRAST.md</Code>.
              </>
            }
          >
            <Group title="Surfaces">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{surfaces.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Text" note="Two levels only. Running text is ink; ink-2 is for what sits beside or under it.">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{inks.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Lines" note="Borders do the work in this system. A hairline is decoration; the edge of a control must reach 3:1, so controls use line-strong.">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{lines.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Brand">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{brand.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group
              title="Status roles"
              note="Amber is a marker, not a text colour: write small deadlines in ink beside an amber dot. There is no success colour: “met” and “passed” are brand green with a tick, told apart from actions by form (a ticked label against a filled button). Info blue labels neutral facts and never colours a link."
            >
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{roles.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Text on each surface" note="ink-2 passes on all three surfaces. Links are ink with a green underline; on green or ink they inherit and the ring turns white.">
              <div className="grid gap-4 md:grid-cols-3">
                {(["paper", "surface", "deep"] as const).map((tone) => (
                  <Canvas key={tone} tone={tone}>
                    <p className="text-sm font-semibold text-ink">text-ink on {tone === "deep" ? "paper-deep" : tone}</p>
                    <p className="text-sm text-ink-2">text-ink-2: muted text</p>
                    <p className="mt-2 text-sm">
                      <a href="#colour">A content link</a>
                    </p>
                  </Canvas>
                ))}
                <Canvas tone="brand">
                  <p className="text-sm font-semibold">White on brand</p>
                  <p className="text-sm text-brand-on-dark">text-brand-on-dark: secondary</p>
                  <p className="mt-2 text-sm">
                    <a href="#colour">A content link</a>
                  </p>
                </Canvas>
                <Canvas tone="ink">
                  <p className="text-sm font-semibold">Paper on ink</p>
                  <p className="text-sm">The independence band</p>
                  <p className="mt-2 text-sm">
                    <a href="#colour">A content link</a>
                  </p>
                </Canvas>
              </div>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="type"
            title="Typography"
            lead="Source Serif 4 for headings and the buyer’s quoted words, Inter for interface and body, IBM Plex Mono for references only. Nothing below 12 px. Sentence case everywhere: no capitals for emphasis."
          >
            <Group title="Families">
              <div className="grid gap-4 md:grid-cols-3">
                <Canvas tone="surface">
                  <p className="font-display text-2xl font-semibold text-ink">Worth your time</p>
                  <p className="mt-1 text-13 text-ink-2">
                    Source Serif 4 · <Code>font-display</Code> · 600 for headings, 400 for quotes
                  </p>
                </Canvas>
                <Canvas tone="surface">
                  <p className="text-xl font-semibold text-ink">Closes 27 Nov 2026, 12:00</p>
                  <p className="mt-1 text-13 text-ink-2">
                    Inter · <Code>font-sans</Code> · 400 / 500 / 600
                  </p>
                </Canvas>
                <Canvas tone="surface">
                  <p className="font-mono text-17 font-medium text-ink">Vol 2 Specification.pdf · p. 31</p>
                  <p className="mt-1 text-13 text-ink-2">
                    IBM Plex Mono · <Code>font-mono</Code> · 400 / 500
                  </p>
                </Canvas>
              </div>
            </Group>

            <Group title="Scale" note="The Tailwind size names are remapped, so any text-* class lands on the scale. text-13, text-15 and text-17 are the added steps.">
              <div className="divide-y divide-line border-y border-line">
                {scale.map((step) => (
                  <div key={step.cls} className="grid gap-x-6 gap-y-1 py-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-baseline">
                    <div>
                      <p className="font-mono text-13 text-ink">{step.cls}</p>
                      <p className="text-xs text-ink-2">
                        {step.size} · {step.role}
                      </p>
                    </div>
                    <p className={`${step.cls} ${"serif" in step && step.serif ? "font-display font-semibold" : ""} ${"semibold" in step && step.semibold ? "font-semibold" : ""} truncate text-ink`}>
                      {step.sample}
                    </p>
                  </div>
                ))}
              </div>
            </Group>

            <Group
              title="Roles"
              note="Use a role class rather than assembling family, size and weight. h1–h3 are serif by default; a heading that is a UI label (a row title, a point) sets font-sans."
            >
              <div className="space-y-6 rounded-card border border-line bg-surface p-6">
                <Specimen label="type-eyebrow · 14 px, 600, brand green, sentence case">
                  <p className="type-eyebrow">The bid desk for small suppliers</p>
                </Specimen>
                <Specimen label="type-hero · 34/38 on phones, 44/48 from 640 px, 50/54 from 1024 px">
                  <p className="type-hero text-ink">
                    Know which public contracts are worth your time <span className="text-brand">— and get a compliant first draft in hours, not days.</span>
                  </p>
                </Specimen>
                <Specimen label="type-h1 · public page title · 30/34, 40/44, 44/48">
                  <p className="type-h1 text-ink">Aldermoor &amp; Pike Building Services Ltd</p>
                </Specimen>
                <Specimen label="type-h2 · section heading on a public page · 28/32, 36/41, 40/45">
                  <p className="type-h2 text-ink">Every requirement, quoted and cited</p>
                </Specimen>
                <Specimen label="type-title · page title in the app · 26/30, 36/42 from 768 px">
                  <p className="type-title text-ink">Planned and responsive maintenance of corporate buildings 2027–2031</p>
                </Specimen>
                <Specimen label="type-section · section heading inside a page · 24/29, 28/34 from 768 px">
                  <p className="type-section text-ink">Pass-or-fail requirements</p>
                </Specimen>
                <Specimen label="type-h3 · step and plan names · 22/27, 24/29 from 640 px">
                  <p className="type-h3 text-ink">Draft, mark, improve</p>
                </Specimen>
                <Specimen label="type-lead · 16/26 on phones, 18/28 from 640 px · ink">
                  <p className="type-lead max-w-[42.5rem] text-ink">
                    No summaries to take on trust. Each line in a check is the buyer’s own sentence, with the file and page it came from.
                  </p>
                </Specimen>
                <Specimen label="type-reading · 16/26 · running text">
                  <p className="type-reading max-w-reading text-ink">
                    Pages are built from published notices and contain public sector information licensed under the Open Government Licence v3.0. Notices can be late,
                    incomplete or wrong, so always check the original notice before you bid.
                  </p>
                </Specimen>
                <Specimen label="type-quote-lg · the quote that leads a card · 20/28, 25/34 from 640 px">
                  <p className="type-quote-lg max-w-[36rem] text-ink">“All operatives working in occupied buildings must hold an Enhanced DBS certificate.”</p>
                </Specimen>
                <Specimen label="type-quote · a quoted requirement in a list · 17/25">
                  <p className="type-quote max-w-[36rem] text-ink">“Tenderers must hold a current Cyber Essentials certificate at the Tender deadline.”</p>
                </Specimen>
                <Specimen label="type-ref (+ text-ink-2) · the meta line above a title, references">
                  <p className="type-ref text-ink-2">Bid brief · built 13 Nov 2026 at 09:42 · 6 files, 214 pages read</p>
                </Specimen>
                <Specimen label="type-figure (+ a size) · large numerals in the serif">
                  <p className="type-figure text-[2.125rem] leading-[1.15] text-ink">£6.4m</p>
                </Specimen>
              </div>
            </Group>

            <Group title="Figures" note="Tables and <time> use tabular figures automatically, so pounds and dates line up down a column. Elsewhere add tabular-nums where figures stack. Right-align numeric columns.">
              <div className="grid max-w-xs grid-cols-[1fr_auto] gap-x-6 text-sm text-ink tabular-nums">
                <span className="text-ink-2">Responsive repairs and voids</span>
                <span className="text-right">£1,850,000</span>
                <span className="text-ink-2">Primary school roofs</span>
                <span className="text-right">£612,400</span>
                <span className="text-ink-2">Civic Hall fire doors</span>
                <span className="text-right">£238,000</span>
              </div>
            </Group>

            <Group title="Links">
              <p className="type-reading max-w-reading text-ink">
                An anchor without a class is a content link: <a href="#type">ink with a green underline, green on hover</a>. On an element that carries its own classes
                use{" "}
                <a href="#type" className="link">
                  <Code>link</Code>
                </a>
                ; in navigation and footers use{" "}
                <a href="#type" className="link-quiet">
                  link-quiet
                </a>
                ; for a reference that is a link use{" "}
                <a href="#type" className="link-ref">
                  Vol 1 · p. 4
                </a>{" "}
                (<Code>link-ref</Code>). Blue is never a link colour.
              </p>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="layout"
            title="Space, radius, shadow"
            lead="Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Public pages sit in a 1200 px column, the app in 1280 px; running text in 68 characters."
          >
            <Group title="Spacing">
              <div className="flex flex-wrap items-end gap-4">
                {[
                  ["1", 4],
                  ["2", 8],
                  ["3", 12],
                  ["4", 16],
                  ["6", 24],
                  ["8", 32],
                  ["12", 48],
                  ["16", 64],
                  ["24", 96],
                ].map(([step, px]) => (
                  <Specimen key={step} label={`${step} · ${px}`}>
                    <span aria-hidden className="block bg-brand-tint ring-1 ring-brand/25" style={{ width: Number(px), height: Number(px) }} />
                  </Specimen>
                ))}
              </div>
            </Group>
            <Group title="Radius" note="Four steps. The Tailwind names snap to them: rounded-sm 4 px, -md 6 px, -lg 8 px (a card inside a card), -xl 10 px, -2xl and up 12 px.">
              <Row>
                <Specimen label="rounded-chip · 4 px · chips, pills, tick boxes">
                  <span className="block h-16 w-28 rounded-chip border border-line-strong bg-surface" />
                </Specimen>
                <Specimen label="rounded-control · 6 px · buttons, inputs, tinted panels">
                  <span className="block h-16 w-28 rounded-control border border-line-strong bg-surface" />
                </Specimen>
                <Specimen label="rounded-card · 10 px · cards, tables">
                  <span className="block h-16 w-28 rounded-card border border-line bg-surface" />
                </Specimen>
                <Specimen label="rounded-modal · 12 px · dialogs, the verdict panel">
                  <span className="block h-16 w-28 rounded-modal border border-line bg-surface" />
                </Specimen>
              </Row>
            </Group>
            <Group title="Shadow" note="Rare. Surfaces have a hairline and no shadow; only what floats above the page casts one.">
              <Row className="gap-x-10">
                <Specimen label="none · the default card">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface" />
                </Specimen>
                <Specimen label="shadow-raised">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface shadow-raised" />
                </Specimen>
                <Specimen label="shadow-overlay · popovers, menus, dialogs">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface shadow-overlay" />
                </Specimen>
                <Specimen label="shadow-float · a product figure on a public page">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface shadow-float" />
                </Specimen>
              </Row>
            </Group>
            <Group title="Containers">
              <ul className="space-y-1.5 text-sm text-ink">
                <li>
                  <Code>container-content</Code> centres the 1200 px column of public pages, with 20 px gutters on phones and 24 px from 640 px.
                </li>
                <li>
                  <Code>container-app</Code> centres the 1280 px column of the app, with 20 px gutters on phones and 32 px from 768 px. The app shell already wraps every page
                  in it.
                </li>
                <li>
                  <Code>max-w-reading</Code> limits running text to about 68 characters.
                </li>
                <li>
                  <Code>hit-40</Code> gives a small control a 44 px hit area without changing how it looks.
                </li>
              </ul>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="brand"
            title="Brand"
            lead="The mark is the designer’s, used exactly as delivered: the top-left corner of a 3 : 4 sheet folded down, its edges leaving a tick. Nothing is drawn on; the tick is the gap the fold leaves. One colour, always."
          >
            <Group title="Mark" note="Heights in px. Smallest mark: 16 px high. The favicon is a separate cut with a heavier tick, pale green in dark browser themes.">
              <Row className="items-end gap-x-10">
                {[16, 20, 24, 32, 48, 96].map((size) => (
                  <Specimen key={size} label={`${size}`}>
                    <LogoMark size={size} />
                  </Specimen>
                ))}
                <Specimen label="App tile">
                  <span className="grid size-24 place-items-center rounded-[1.375rem] bg-brand">
                    <LogoMark size={60} className="text-white" />
                  </span>
                </Specimen>
                <Specimen label="Favicon cut · light, dark">
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-chip border border-line bg-surface">
                      <svg viewBox="0 0 32 32" className="size-4 fill-brand" aria-hidden>
                        <path d={MARK_FAVICON} />
                      </svg>
                    </span>
                    <span className="grid size-8 place-items-center rounded-chip bg-ink">
                      <svg viewBox="0 0 32 32" className="size-4 fill-brand-on-dark" aria-hidden>
                        <path d={MARK_FAVICON} />
                      </svg>
                    </span>
                  </span>
                </Specimen>
              </Row>
            </Group>
            <Group
              title="Lockup"
              note="Mark and “Bidfolio” in Source Serif 4 Semibold (−0.015em, optical size 32), aligned on the baseline; the mark is 0.91 of the type size. Smallest lockup: 20 px high. Keep one mark-width clear on every side."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Canvas tone="paper" className="flex flex-col items-start gap-6">
                  <Wordmark size="lg" />
                  <Wordmark size="md" />
                  <Wordmark size="sm" />
                  <Wordmark size="md" tone="ink" />
                </Canvas>
                <div className="grid gap-4">
                  <Canvas tone="brand" className="flex flex-col items-start gap-6">
                    <Wordmark size="lg" tone="inverse" />
                    <Wordmark size="sm" tone="inverse" />
                  </Canvas>
                  <Canvas tone="ink" className="flex flex-col items-start gap-6">
                    <Wordmark size="md" tone="paper" />
                  </Canvas>
                </div>
              </div>
            </Group>
            <Group title="Do not">
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink marker:text-ink-2">
                <li>redraw, outline, tilt or shade the mark, or give the tick a second colour;</li>
                <li>use it in anything but green or ink on light, white or paper on dark;</li>
                <li>use crowns, crests, GOV.UK black and blue, or wording that suggests an official service;</li>
                <li>use emoji, stock illustration or “AI sparkle” icons anywhere in the product.</li>
              </ul>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="buttons" title="Buttons" lead="One green button per view; everything else is outlined. 44 px tall, 6 px radius, 15 px semibold. Small sizes keep a 44 px hit area.">
            <Group title="Variants">
              <Row>
                <Specimen label="default">
                  <Button>
                    Open draft answers <ArrowRight aria-hidden strokeWidth={2.2} />
                  </Button>
                </Specimen>
                <Specimen label="outline">
                  <Button variant="outline">
                    <Download aria-hidden /> Export to Word
                  </Button>
                </Specimen>
                <Specimen label="secondary">
                  <Button variant="secondary">Dismiss</Button>
                </Specimen>
                <Specimen label="ghost">
                  <Button variant="ghost">Cancel</Button>
                </Specimen>
                <Specimen label="destructive">
                  <Button variant="destructive">Delete bid</Button>
                </Specimen>
                <Specimen label="link">
                  <Button variant="link">Original notice</Button>
                </Specimen>
              </Row>
            </Group>
            <Group title="Sizes">
              <Row>
                <Specimen label="lg · 52 px · beside the company search">
                  <Button size="lg">
                    Show my page <ArrowRight aria-hidden strokeWidth={2.2} />
                  </Button>
                </Specimen>
                <Specimen label="default · 44 px">
                  <Button>
                    <Upload aria-hidden /> Upload tender pack
                  </Button>
                </Specimen>
                <Specimen label="sm · 36 px">
                  <Button size="sm" variant="outline">
                    Confirm
                  </Button>
                </Specimen>
                <Specimen label="xs · 28 px">
                  <Button size="xs" variant="outline">
                    Apply
                  </Button>
                </Specimen>
                <Specimen label="icon · 44 px">
                  <Button size="icon" variant="outline" aria-label="Add">
                    <Plus aria-hidden />
                  </Button>
                </Specimen>
                <Specimen label="icon-sm">
                  <Button size="icon-sm" variant="ghost" aria-label="Search">
                    <Search aria-hidden />
                  </Button>
                </Specimen>
              </Row>
            </Group>
            <Group title="States" note="Hover, pressed and focus are shown frozen; the live buttons above behave the same way.">
              <div className="space-y-5">
                <Row>
                  <Specimen label="default">
                    <StateChip className="bg-brand text-white">Claim this page</StateChip>
                  </Specimen>
                  <Specimen label="hover">
                    <StateChip className="bg-brand-hover text-white">Claim this page</StateChip>
                  </Specimen>
                  <Specimen label="pressed">
                    <StateChip className="bg-brand-hover text-white shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]">Claim this page</StateChip>
                  </Specimen>
                  <Specimen label="focus-visible">
                    <StateChip className="bg-brand text-white outline-2 outline-offset-2 outline-focus">Claim this page</StateChip>
                  </Specimen>
                  <Specimen label="disabled">
                    <Button disabled>Claim this page</Button>
                  </Specimen>
                  <Specimen label="loading (click)">
                    <LoadingButtonDemo />
                  </Specimen>
                </Row>
                <Row>
                  <Specimen label="default">
                    <StateChip className="border-line-strong! bg-surface text-ink">Get bid check</StateChip>
                  </Specimen>
                  <Specimen label="hover">
                    <StateChip className="border-ink! bg-paper text-ink">Get bid check</StateChip>
                  </Specimen>
                  <Specimen label="pressed">
                    <StateChip className="border-ink! bg-paper-deep text-ink">Get bid check</StateChip>
                  </Specimen>
                  <Specimen label="focus-visible">
                    <StateChip className="border-line-strong! bg-surface text-ink outline-2 outline-offset-2 outline-focus">Get bid check</StateChip>
                  </Specimen>
                  <Specimen label="disabled">
                    <Button variant="outline" disabled>
                      Get bid check
                    </Button>
                  </Specimen>
                  <Specimen label="loading">
                    <Button variant="outline" loading>
                      Saving…
                    </Button>
                  </Specimen>
                </Row>
              </div>
            </Group>
            <Group title="On brand green" note="Wrap the panel in .on-brand (or .on-ink) so that the focus ring and text selection turn white. The featured plan card is built this way.">
              <Canvas tone="brand">
                <Row>
                  <Specimen label={<span className="text-brand-on-dark">inverse</span>}>
                    <Button variant="inverse">Start Bid Desk</Button>
                  </Specimen>
                  <Specimen label={<span className="text-brand-on-dark">inverse-outline</span>}>
                    <Button variant="inverse-outline">See a sample check</Button>
                  </Specimen>
                </Row>
              </Canvas>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="forms"
            title="Form controls"
            lead="Label above (14 px, 600), helper below, error in danger with an icon and words. 44 px tall with a line-strong edge; 16 px text so that iOS does not zoom."
          >
            <Group title="Text input: states">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sg-in-1">Default</Label>
                  <Input id="sg-in-1" placeholder="Company name or number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-in-2">Hover</Label>
                  <Input id="sg-in-2" placeholder="Company name or number" className="border-ink" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-in-3">Focus</Label>
                  <Input id="sg-in-3" defaultValue="Aldermoor & Pike" className="border-brand outline-2 outline-offset-2 outline-focus" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-in-4">Filled</Label>
                  <Input id="sg-in-4" defaultValue="Aldermoor & Pike Building Services Ltd" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-in-5">Disabled</Label>
                  <Input id="sg-in-5" defaultValue="joanne@aldermoorpike.example" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-in-6">Read-only</Label>
                  <Input id="sg-in-6" defaultValue="Company no. as published" readOnly />
                </div>
              </div>
            </Group>

            <Group title="Field with helper and error" note="FormField wires the label, aria-describedby and aria-invalid for you. Validate on blur and on submit.">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <FormField label="Public liability cover" name="sg-cover" defaultValue="£10,000,000" hint="The limit for any one occurrence, as stated on your certificate." />
                <FormField label="Policy renewal date" name="sg-renewal" defaultValue="31/02/2027" error="Enter a real date, for example 30 06 2027." />
              </div>
              <div className="mt-5 max-w-md">
                <FormError message="We could not save your changes. Check your connection and try again." />
              </div>
            </Group>

            <Group title="Textarea, select and file">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sg-ta">Note</Label>
                  <Textarea id="sg-ta" placeholder="Why this requirement is met, or what is missing" aria-describedby="sg-ta-hint" />
                  <FieldHint id="sg-ta-hint">Visible to everyone in the workspace.</FieldHint>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="sg-native">Native select</Label>
                    <NativeSelect id="sg-native" defaultValue="member" className="w-full">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </NativeSelect>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Specimen label="Select">
                      <SelectDemo />
                    </Specimen>
                    <Specimen label="Select, invalid">
                      <div>
                        <SelectDemo invalid />
                        <FieldError className="mt-2">Choose a region.</FieldError>
                      </div>
                    </Specimen>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sg-file">File</Label>
                  <Input id="sg-file" type="file" className="max-w-md py-0" />
                </div>
              </div>
            </Group>

            <Group title="Checkbox, radio and switch" note="20 px controls with a 44 px hit area. The label is always clickable.">
              <ChoiceDemo />
            </Group>

            <Group title="Live count against a limit">
              <WordCountDemo />
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="badges" title="Badges and chips" lead="4 px radius, 12 px, tinted or outlined, never loud. The words carry the meaning; colour and an icon support them.">
            <Group title="Variants">
              <Row>
                <Specimen label="default">
                  <Badge>Verdict</Badge>
                </Specimen>
                <Specimen label="strong">
                  <Badge variant="strong">Mandatory</Badge>
                </Specimen>
                <Specimen label="outline">
                  <Badge variant="outline">Pass / fail</Badge>
                </Specimen>
                <Specimen label="secondary">
                  <Badge variant="secondary">Free</Badge>
                </Specimen>
                <Specimen label="brand">
                  <Badge variant="brand">Radar Pro</Badge>
                </Specimen>
                <Specimen label="warning">
                  <Badge variant="warning">14 days left</Badge>
                </Specimen>
                <Specimen label="success">
                  <Badge variant="success">Active</Badge>
                </Specimen>
                <Specimen label="destructive">
                  <Badge variant="destructive">Past due</Badge>
                </Specimen>
                <Specimen label="info">
                  <Badge variant="info">Tender notice</Badge>
                </Specimen>
              </Row>
            </Group>
            <Group title="Properties of a question or requirement" note="Outlined, 12 px semibold. The one that matters most gets the ink edge.">
              <Row>
                <Specimen label="strong · outline · outline">
                  <span className="flex flex-wrap gap-1.5">
                    <Badge variant="strong">15% of marks</Badge>
                    <Badge variant="outline">Limit 1,000 words</Badge>
                    <Badge variant="outline">Scored 0 to 5</Badge>
                  </span>
                </Specimen>
              </Row>
            </Group>
            <Group
              title="Reasons a tender matches"
              note="Quiet chips, 12 px medium: the strongest reason on brand-tint, the others on paper-deep. Show only facts we hold: same category, a buyer you have won from, region. No distances until postcodes are geocoded."
            >
              <span className="flex flex-wrap gap-1.5">
                <Badge variant="brand">You have won 3 contracts from this buyer</Badge>
                <Badge variant="secondary">Same work as 6 of your wins</Badge>
                <Badge variant="secondary">Yorkshire and the Humber</Badge>
              </span>
            </Group>
            <Group title="Category chip" note="A CPV code in mono with its name, on paper-deep.">
              <span className="flex flex-wrap gap-2">
                {[
                  ["45453100", "Refurbishment work"],
                  ["50700000", "Building repair and maintenance"],
                  ["45261900", "Roof repair"],
                ].map(([code, name]) => (
                  <span key={code} className="rounded-chip bg-paper-deep px-2.5 py-1 text-13 text-ink">
                    <span className="font-mono text-xs text-ink-2">{code}</span> {name}
                  </span>
                ))}
              </span>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="bid"
            title="Bid components"
            lead="The shared pieces of the supplier page, the bid brief and the answer editor. Use these components rather than rebuilding them, so that a deadline, a status and a reference look the same on every screen."
          >
            <Group title="Status pill" note="The state of a requirement: 13 px semibold on a tint, with a sign. “Met” is brand green with a tick: there is no separate success colour.">
              <Row>
                <Specimen label='status="gap"'>
                  <StatusPill status="gap" />
                </Specimen>
                <Specimen label='status="confirm"'>
                  <StatusPill status="confirm" />
                </Specimen>
                <Specimen label='status="met"'>
                  <StatusPill status="met" />
                </Specimen>
                <Specimen label='status="unknown"'>
                  <StatusPill status="unknown" />
                </Specimen>
              </Row>
              <div className="mt-4">
                <Snippet>{`import { StatusPill } from "@/components/ui/status-pill";

<StatusPill status="gap" />            // Gap
<StatusPill status="confirm" />        // For you to confirm
<StatusPill status="met" />            // Met`}</Snippet>
              </div>
            </Group>

            <Group
              title="Reference chip"
              note="Where a quoted sentence comes from: file, page and clause in mono on paper with a hairline edge. With href it opens the source at that page. A long file name is shortened; the page and clause never are."
            >
              <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-5">
                <ReferenceChip file="Vol 2 Specification.pdf" page="31" clause="§7.4.2" href="#bid" />
                <ReferenceChip file="Vol 3 Quality Questionnaire.docx" page="6" clause="Q2" />
                <span className="block w-64 max-w-full">
                  <ReferenceChip file="Vol 1 Instructions to Tenderers.pdf" page="11" clause="§4.6" href="#bid" />
                </span>
                <ReferenceChip owner="Yours" file="CHAS certificate 2026.pdf" page="1" className="border-transparent bg-transparent px-0 text-ink-2" />
              </div>
              <div className="mt-4">
                <Snippet>{`import { ReferenceChip } from "@/components/ui/reference-chip";

<ReferenceChip file="Vol 2 Specification.pdf" page="31" clause="§7.4.2" href={sourceUrl} />`}</Snippet>
              </div>
            </Group>

            <Group
              title="Deadline marker"
              note="An amber dot, the date in ink, and a small amber-tint pill with the time left. Amber is only the marker: the words are ink, so the date reads at any size. Always include the absolute date."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col items-start gap-4 rounded-card border border-line bg-surface p-5">
                  <Specimen label='size="sm" · rows in a card'>
                    <DeadlineMarker size="sm" left="14 days left">
                      Closes 27 Nov 2026
                    </DeadlineMarker>
                  </Specimen>
                  <Specimen label='size="md" (default) · toolbars'>
                    <DeadlineMarker left="14 days left">Closes 27 Nov 2026, 12:00</DeadlineMarker>
                  </Specimen>
                  <Specimen label='size="lg" · key dates'>
                    <DeadlineMarker size="lg" left="5 days left">
                      18 Nov 2026, 17:00
                    </DeadlineMarker>
                  </Specimen>
                  <Specimen label="closed">
                    <DeadlineMarker closed>Closed 3 Nov 2026</DeadlineMarker>
                  </Specimen>
                </div>
                <Snippet>{`import { DeadlineMarker, timeLeft } from "@/components/ui/deadline-marker";

<DeadlineMarker left={timeLeft(tender.deadline)}>
  Closes {formatDate(tender.deadline)}
</DeadlineMarker>

// timeLeft() → "14 days left", "1 day left",
// "Closes today", or null once it has passed.`}</Snippet>
              </div>
            </Group>

            <Group title="Filter chips" note="Toggle buttons above a list, 44 px tall: the chosen one is filled ink. Each carries its count. The same style serves the monthly / annual switch on the pricing page.">
              <FilterChipDemo />
            </Group>

            <Group
              title="Mark against the scheme"
              note="One bar per point of the buyer’s scale. The words say what it is: a reading of the scoring scheme, never a forecast. Do not write “likely score” or “predicted”."
            >
              <div className="max-w-sm rounded-lg bg-paper-deep p-4">
                <p className="text-xs text-ink-2">Marked against the buyer’s scheme</p>
                <p className="mt-1 flex items-baseline gap-2 text-ink">
                  <span className="type-figure text-[2.75rem] leading-none">3</span>
                  <span className="text-15 font-semibold">of 5</span>
                  <span className="text-15">· Satisfactory</span>
                </p>
                <ScoreBars filled={3} className="mt-3" />
                <p className="mt-3 border-t border-line pt-3 text-13 text-ink-2">A reading of the scoring scheme, not a forecast of the buyer’s decision.</p>
              </div>
            </Group>

            <Group title="A requirement, assembled" note="How the pieces sit together in a row of the bid brief.">
              <div className="rounded-card border border-line bg-surface">
                <div className="border-b border-line px-5 py-3 sm:px-6">
                  <FilterChipDemo />
                </div>
                {(
                  [
                    {
                      id: "R-14",
                      quote: "All operatives working in occupied buildings must hold an Enhanced DBS certificate issued within the three years before the Contract Commencement Date.",
                      file: "Vol 2 Specification.pdf",
                      page: "31",
                      clause: "§7.4.2",
                      status: "gap",
                      note: "No DBS register or certificate dates in any of your 12 documents.",
                      action: "Upload evidence",
                    },
                    {
                      id: "R-06",
                      quote: "The Contractor must hold SSIP-accredited health and safety certification and maintain it throughout the Contract Period.",
                      file: "Vol 1 Instructions to Tenderers.pdf",
                      page: "10",
                      clause: "§4.5",
                      status: "confirm",
                      note: "Your CHAS certificate expires on 14 Feb 2027, before the contract starts. Confirm you will renew it.",
                      action: "Confirm",
                    },
                    {
                      id: "R-01",
                      quote: "Tenderers must hold Employer’s Liability insurance of not less than £10,000,000 and Public Liability insurance of not less than £10,000,000 for any one occurrence.",
                      file: "Vol 1 Instructions to Tenderers.pdf",
                      page: "9",
                      clause: "§4.3",
                      status: "met",
                      note: "Employer’s Liability £10m and Public Liability £10m, both valid to 31 Mar 2027.",
                      action: null,
                    },
                  ] as const
                ).map((row, index) => (
                  <div key={row.id} className={`flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-[1.125rem] sm:px-6 ${index > 0 ? "border-t border-line" : ""}`}>
                    <span className="w-14 shrink-0 pt-1 font-mono text-13 font-medium text-ink">{row.id}</span>
                    <div className="flex min-w-0 flex-[1_1_22rem] flex-col items-start gap-2.5">
                      <p className="type-quote text-ink">“{row.quote}”</p>
                      <ReferenceChip file={row.file} page={row.page} clause={row.clause} href="#bid" />
                    </div>
                    <div className="flex min-w-0 flex-[0_1_18.75rem] flex-col items-start gap-1.5">
                      <StatusPill status={row.status} />
                      <p className="text-13 text-ink">{row.note}</p>
                      {row.action ? (
                        <Button variant="outline" className="mt-1 px-3.5 text-sm">
                          {row.action}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="alerts"
            title="Alerts"
            lead={
              <>
                A tinted panel for things a person must read on the page: 6 px radius, no outline, the title in the hue of the state. The default role is{" "}
                <Code>alert</Code>; pass <Code>role=&quot;status&quot;</Code> or <Code>role=&quot;note&quot;</Code> when it should not interrupt a screen reader.
              </>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Alert variant="destructive">
                <AlertTitle>Gap: no evidence found</AlertTitle>
                <AlertDescription>
                  <p>None of the 12 documents you have uploaded contains a DBS register or certificate dates. Add one before you answer Q3.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="success" role="status">
                <AlertTitle>You can comply</AlertTitle>
                <AlertDescription>
                  <p>19 of the 23 pass-or-fail requirements are already met by your documents.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="info" role="note">
                <AlertTitle>A stretch on size</AlertTitle>
                <AlertDescription>
                  <p>At £4.2m this is more than twice your largest contract. Expect to be marked on capacity in Q4.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="warning" role="status">
                <AlertTitle>Payment failed</AlertTitle>
                <AlertDescription>
                  <p>Paid features stay on until 20 Nov 2026. Update your payment method to keep them.</p>
                </AlertDescription>
              </Alert>
              <Alert role="note">
                <AlertTitle>AI-assisted analysis</AlertTitle>
                <AlertDescription>
                  <p>Check it against the tender documents. You remain responsible for your submission.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="warning" role="note" icon={false}>
                <AlertTitle>Without an icon</AlertTitle>
                <AlertDescription>
                  <p>
                    Pass <Code>icon={"{false}"}</Code> for dense layouts where the title already says what kind of message it is.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="surfaces" title="Cards and feedback" lead="A card is a white surface with a hairline edge and a 10 px radius. No shadow unless it floats above the page.">
            <Group title="Card">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Is this your company?</CardTitle>
                    <CardDescription>Nobody has claimed this page yet. Claim it to correct details and choose what appears here. It is free.</CardDescription>
                  </CardHeader>
                  <CardFooter className="flex-wrap gap-x-5">
                    <Button>Claim this page</Button>
                    <a href="#surfaces" className="link text-sm">
                      Flag a mistake
                    </a>
                  </CardFooter>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-sans text-base">Pack files</CardTitle>
                    <CardDescription>
                      6 files, 214 pages. A utility card sets its title in Inter: <Code>font-sans text-base</Code>.
                    </CardDescription>
                    <CardAction>
                      <Button variant="outline" size="sm">
                        Add
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-line border-t border-line text-sm">
                      {[
                        ["Vol 1 Instructions to Tenderers.pdf", "38 pp"],
                        ["Vol 2 Specification.pdf", "96 pp"],
                        ["Vol 4 Pricing Schedule.xlsx", "5 sheets"],
                      ].map(([file, size]) => (
                        <li key={file} className="flex items-baseline justify-between gap-4 py-2.5">
                          <a href="#surfaces" className="link-ref truncate text-ink">
                            {file}
                          </a>
                          <span className="shrink-0 text-13 text-ink-2 tabular-nums">{size}</span>
                        </li>
                      ))}
                    </ul>
                    <Separator />
                    <p className="mt-4 text-13 text-ink-2">
                      Hairline rules (<Code>Separator</Code>) divide content inside a card.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </Group>
            <Group title="Tinted panel" note="The verdict of a bid brief sits on brand-tint with a 12 px radius; a well for a secondary reading sits on paper-deep with 8 px.">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-modal bg-brand-tint p-6">
                  <Badge>Verdict</Badge>
                  <p className="mt-3 font-display text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.015em] text-ink">Worth bidding, if you close two gaps first.</p>
                </div>
                <div className="rounded-lg bg-paper-deep p-6">
                  <p className="text-xs text-ink-2">How it is marked</p>
                  <p className="mt-1 text-15 text-ink">
                    <span className="font-semibold">Quality 50%, price 40%, social value 10%.</span> Answers scored 0 to 5.
                  </p>
                </div>
              </div>
            </Group>
            <Group title="Progress" note="Always next to the number it represents.">
              <div className="grid max-w-xl gap-4">
                {(
                  [
                    ["brand", 41, "412 of 1,000 words"],
                    ["warning", 92, "460 of 500 words"],
                    ["danger", 100, "3 of 3 seats in use · limit reached"],
                  ] as const
                ).map(([tone, value, label]) => (
                  <div key={tone} className="grid grid-cols-[1fr_auto] items-center gap-x-4">
                    <Progress value={value} tone={tone} aria-label={label} />
                    <span className="text-13 text-ink-2 tabular-nums">{label}</span>
                  </div>
                ))}
              </div>
            </Group>
            <Group title="Loading" note="Skeletons for content that is on its way; a spinner only inside a control or for a short wait.">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3 rounded-card border border-line bg-surface p-5" aria-busy="true" aria-label="Loading tender">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-ink-2">
                  <Spinner label="Reading files" /> Reading files…
                </div>
              </div>
            </Group>
            <Group title="Avatar" note="Initials on brand-tint, in brand green.">
              <Row>
                <Specimen label="sm">
                  <Avatar size="sm">
                    <AvatarFallback>J</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="default">
                  <Avatar>
                    <AvatarFallback>JP</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="lg">
                  <Avatar size="lg">
                    <AvatarFallback>JP</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="group">
                  <AvatarGroup>
                    <Avatar>
                      <AvatarFallback>JP</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>IF</AvatarFallback>
                    </Avatar>
                    <AvatarGroupCount>+3</AvatarGroupCount>
                  </AvatarGroup>
                </Specimen>
              </Row>
            </Group>
            <Group title="Toasts" note="For confirming an action the person just took. Anything they must act on goes in the page as an Alert.">
              <ToastDemo />
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="navigation" title="Navigation">
            <Group
              title="Tabs"
              note="The underline style of the supplier page and the bid brief: ink labels on a hairline, a 2 px ink rule under the current one, counts in mono. For sections that are separate pages, use links styled with tabListClasses and tabTriggerClasses (see SettingsNav)."
            >
              <TabsDemo />
            </Group>
            <Group
              title="Breadcrumb"
              note="Above the title of a deep page: 14 px, slashes, links underlined in grey. On phones the shell shows one link back to the parent instead. A page whose URL contains an id names itself with BreadcrumbTrail (see Page patterns)."
            >
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#navigation">Bids</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#navigation">Calderbrook MBC</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Bid brief</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </Group>
            <Group title="Pagination">
              <Pagination className="justify-start">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#navigation" disabled />
                  </PaginationItem>
                  <PaginationItem className="max-sm:hidden">
                    <PaginationLink href="#navigation" isActive>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem className="max-sm:hidden">
                    <PaginationLink href="#navigation">2</PaginationLink>
                  </PaginationItem>
                  <PaginationItem className="max-sm:hidden">
                    <PaginationLink href="#navigation">3</PaginationLink>
                  </PaginationItem>
                  <PaginationItem className="max-sm:hidden">
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem className="max-sm:hidden">
                    <PaginationLink href="#navigation">7</PaginationLink>
                  </PaginationItem>
                  <PaginationItem className="px-2 text-sm text-ink-2 sm:hidden">Page 1 of 7</PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#navigation" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </Group>
            <Group title="Disclosure" note="Native details/summary: a serif question on a hairline with a chevron. Works without JavaScript, findable with in-page search, prints open.">
              <DisclosureGroup className="max-w-[45rem]">
                <Disclosure summary="Is Bidfolio part of GOV.UK?" open>
                  <p>No. Bidfolio is an independent company. You still submit your bid through the buyer’s own portal.</p>
                </Disclosure>
                <Disclosure summary="Will the drafts invent things about my company?">
                  <p>No. Drafts are written only from documents you upload, and each claim carries a marker back to its source.</p>
                </Disclosure>
              </DisclosureGroup>
            </Group>
            <Group title="Disclosure, inline" note='variant="inline": a secondary step tucked into a card or a table row. The summary reads as a link with the same chevron; what it reveals follows in the text size around it.'>
              <Disclosure variant="inline" summary="Marked the wrong rows, or the wrong day?">
                <p className="text-ink-2">Tick those rows in the table and clear their date. They can then be marked again.</p>
              </Disclosure>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="tables"
            title="Tables"
            lead="A white card with small muted column heads and hairline rows, top-aligned. No zebra; row hover in brand tint; numeric columns right-aligned with tabular figures. A second line in a cell is 12 px muted (mono for a reference). On phones, prefer a list of rows to a table with more than three columns."
          >
            <Table framed containerClassName="max-h-[26rem]" className="min-w-[46rem]">
              <TableCaption>From contract award notices that name your company. Values as published by the buyer.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead numeric>Value</TableHead>
                  <TableHead>Awarded</TableHead>
                  <TableHead>Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Responsive repairs and voids, Lot 2 (East)", "2024/S 000-007215", "Wharfedale & Aire Homes", "£1,850,000", "4 Mar 2024", "31 Mar 2027", "running · no extension left"],
                    ["Civic Hall fire door replacement", "2025/S 000-071930", "Calderbrook Metropolitan Borough Council", "£238,000", "11 Nov 2025", "30 Apr 2026", "completed"],
                    ["Primary school roof replacement programme", "2025/S 000-033408", "Three Ridings Academies Trust", "£612,400", "2 Jun 2025", "31 Aug 2026", "completed"],
                    ["Sheltered housing kitchens and bathrooms", "2023/S 000-019877", "Harrowmere Borough Council", "Value not published", "17 Jul 2023", "30 Nov 2025", "completed"],
                    ["Depot refurbishment", "2022/S 000-041120", "Calderbrook Metropolitan Borough Council", "£410,000", "9 May 2022", "30 Nov 2022", "completed"],
                  ] as const
                ).map(([title, notice, buyer, value, awarded, ends, state], index) => (
                  <TableRow key={notice} data-state={index === 1 ? "selected" : undefined}>
                    <TableCell>
                      <span className="block font-semibold text-ink">{title}</span>
                      <span className="type-ref block text-ink-2">{notice}</span>
                    </TableCell>
                    <TableCell>{buyer}</TableCell>
                    <TableCell numeric className={value.startsWith("£") ? undefined : "text-ink-2"}>
                      {value}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{awarded}</TableCell>
                    <TableCell>
                      <span className="block whitespace-nowrap">{ends}</span>
                      <span className="block text-xs text-ink-2">{state}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-13 text-ink-2">
              The second row is selected (<Code>data-state=&quot;selected&quot;</Code>). Give the container a maximum height and the header stays while the rows scroll.
            </p>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="overlays" title="Overlays" lead="White surface, hairline, overlay shadow. 10 px radius for menus and popovers, 12 px for dialogs. Escape closes all of them and focus returns to the trigger.">
            <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
              <Group title="Popover: a source marker" note="In a draft, each claim carries a numbered marker back to the passage it rests on. Click it to read the passage with its file and page.">
                <CitationPopoverDemo />
              </Group>
              <Group title="Dialog" note="For a decision that must be made before going on. On phones it rises from the bottom edge.">
                <DialogDemo />
              </Group>
              <Group title="Dropdown menu" note="Items are 40 px on touch screens. Destructive items sit last, after a rule.">
                <DropdownDemo />
              </Group>
              <Group title="Tooltip" note="A short label, or the exact figure behind a rounded one. Never essential information.">
                <TooltipDemo />
              </Group>
            </div>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="patterns"
            title="Page patterns"
            lead="The app shell gives every page the white top bar (logo, Radar, Bids, Documents; workspace and account menu on the right), a 1280 px container, and the page’s breadcrumb above its title. A page supplies a PageHeader and its content."
          >
            <Group title="Page header">
              <Canvas tone="paper">
                <PageHeader
                  eyebrow="Bid brief · built 13 Nov 2026 at 09:42 · 6 files, 214 pages read"
                  title="Planned and responsive maintenance of corporate buildings 2027–2031"
                  description={
                    <>
                      <span className="text-ink">Calderbrook Metropolitan Borough Council</span> · Tender notice <span className="font-mono text-13">2026/S 000-048213</span>
                    </>
                  }
                  meta={<DeadlineMarker left="14 days left">Closes 27 Nov 2026, 12:00</DeadlineMarker>}
                  actions={
                    <>
                      <Button variant="outline">
                        <Download aria-hidden /> Export to Word
                      </Button>
                      <Button>
                        Open draft answers <ArrowRight aria-hidden strokeWidth={2.2} />
                      </Button>
                    </>
                  }
                />
              </Canvas>
              <div className="mt-4">
                <Snippet>{`<BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.buyerShort, href: buyerUrl }, { label: "Bid brief" }]} />
<PageHeader
  eyebrow="Bid brief · built 13 Nov 2026 at 09:42 · 6 files, 214 pages read"
  title={bid.title}
  description={bid.buyer}
  meta={<DeadlineMarker left={timeLeft(bid.deadline)}>Closes {formatDate(bid.deadline)}</DeadlineMarker>}
  actions={<Button>Open draft answers</Button>}
/>

// Under a shared title and tabs (the Settings pages): <PageHeader level={2} … />`}</Snippet>
              </div>
            </Group>
            <Group title="Section and empty state" note="One sentence about what belongs here, one action, optionally an example. No illustration.">
              <Canvas tone="paper">
                <PageSection title="Documents" description="Policies, certificates, case studies and past bids your drafts are written from." action={<Button variant="outline">Upload</Button>}>
                  <EmptyState
                    title="No documents yet"
                    description="Upload the documents you reuse in bids. Drafts are written only from what is here."
                    action={
                      <Button>
                        <Upload aria-hidden /> Upload documents
                      </Button>
                    }
                    example={
                      <>
                        <span className="font-semibold text-ink">For example:</span> a health and safety policy, your insurance certificates, two case studies and the last
                        bid you were pleased with.
                      </>
                    }
                  />
                </PageSection>
              </Canvas>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="domain"
            title="Domain recipes"
            lead="Treatments the feature modules should share where there is no component yet. Copy the classes; if you use one twice, make it a component in src/components/ui."
          >
            <div className="grid gap-x-8 gap-y-10 md:grid-cols-2">
              <Group title="Stat block" note="A large serif numeral over a 13 px muted label, in one white card divided by hairlines." className="md:col-span-2">
                <dl className="grid rounded-card border border-line bg-surface sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["14", "public contracts won since 2021"],
                    ["£6.4m", "total awarded value"],
                    ["9", "public buyers"],
                    ["4", "open tenders like your past work"],
                  ].map(([value, label], index) => (
                    <div key={label} className={`flex flex-col-reverse gap-0.5 px-6 py-[1.125rem] ${index > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:max-lg:border-t sm:max-lg:border-l-0" : ""} ${index === 3 ? "sm:max-lg:border-t" : ""}`}>
                      <dt className="text-13 text-ink-2">{label}</dt>
                      <dd className="type-figure text-[2.125rem] leading-[1.15] text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Group>
              <Group title="Money" note="Rounded for reading, exact in tables; never £0 for an unknown value.">
                <ul className="space-y-1.5 text-sm text-ink">
                  <li>
                    <span className="font-semibold tabular-nums">£4.2m</span> <span className="text-ink-2">· estimated value in a row: one decimal place above a million</span>
                  </li>
                  <li>
                    <span className="tabular-nums">£1,850,000</span> <span className="text-ink-2">· exact, right-aligned, in a table</span>
                  </li>
                  <li>
                    <span className="text-ink-2">Value not published · in ink-2, in words</span>
                  </li>
                </ul>
              </Group>
              <Group title="Source marker" note="In a draft: a small mono number on brand-tint, 3 px radius. The chosen source is filled brand green.">
                <p className="max-w-md text-15 leading-[1.6] text-ink">
                  …where it has handled 11,260 orders since March 2024.{" "}
                  <span className="rounded-[3px] bg-brand-tint px-1 font-mono text-xs font-medium text-brand">1</span> We completed 94.8% of routine repairs within target.{" "}
                  <span className="rounded-[3px] bg-brand px-1 font-mono text-xs font-medium text-white">3</span>
                </p>
              </Group>
              <Group title="A labelled gap in a draft" note="Where the documents do not support a point the question asks for, the draft says what is missing instead of guessing.">
                <p className="max-w-md text-15 leading-[1.6] text-ink">
                  Calls outside working hours are answered by our duty supervisor.{" "}
                  <span className="rounded-chip bg-danger-tint box-decoration-clone px-1.5 py-0.5 text-13 font-semibold text-danger">Gap: how a night call reaches the engineer</span>
                </p>
              </Group>
              <Group title="Upgrade notice" note="Inline, never a modal trap: what is locked, what the plan includes, the price, one button.">
                <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
                  <p className="font-display text-xl font-semibold text-ink">Drafting is part of Bid Desk</p>
                  <p className="mt-1.5 text-sm text-ink-2">Your check is ready. To draft and mark the 6 scored questions, start a full bid: 3 a month on Bid Desk, or one with a Bid Pass.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <Button>Start Bid Desk · £149 a month</Button>
                    <Button variant="outline">Buy a Bid Pass · £99</Button>
                  </div>
                </div>
              </Group>
              <Group title="Data attribution" note="On every page that shows public data.">
                <p className="max-w-md text-13 text-ink-2">
                  Contains public sector information licensed under the <a href="#domain">Open Government Licence v3.0</a>. Bidfolio is an independent service and is not
                  part of GOV.UK. <a href="#domain">Flag a mistake</a>.
                </p>
              </Group>
            </div>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="accessibility" title="Accessibility" lead="The bar is WCAG 2.2 AA. These are the parts the primitives cannot do for you.">
            <ul className="grid gap-x-8 gap-y-5 text-sm text-ink sm:grid-cols-2">
              {[
                ["Focus", "Never remove the focus ring. It is global: 2 px brand green with a 2 px offset, white on green or ink. Inside clipped containers use -outline-offset-2."],
                ["Targets", "44 px minimum on touch. Small controls use hit-40."],
                ["Colour", "Status is always a sign and words. Brand green and info blue are equally dark: never ask them to be told apart by colour alone. Check any new pair with scripts/design/contrast.mjs."],
                ["Headings", "One h1 per page (PageHeader). Sections are h2, groups h3. Do not skip levels for size: use the type roles."],
                ["Live regions", "Processing updates: aria-live=\"polite\". Errors that need attention: role=\"alert\"."],
                ["Motion", "State changes only, 120 to 180 ms, ease-out. prefers-reduced-motion is honoured globally."],
                ["Dates", "Always include the absolute date next to the time left, for print and for screen readers."],
                ["Print", "Public pages and legal documents print as documents: mark chrome with data-print=\"hide\"."],
              ].map(([title, body]) => (
                <li key={title} className="border-t border-line pt-3">
                  <span className="block text-17 font-semibold text-ink">{title}</span>
                  {body}
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-2">
              Back to the <Link href="/">homepage</Link>.
            </p>
          </GuideSection>
        </main>
      </div>
    </div>
  );
}
