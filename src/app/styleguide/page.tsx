import { ArrowRight, CircleAlert, CircleCheck, CircleDashed, CircleHelp, Clock, Download, Plus, Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, PageSection } from "@/components/app/page-header";
import { FieldError, FieldHint, FormError, FormField } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Logo, LogoMark, Wordmark } from "@/components/logo";
import {
  ChoiceDemo,
  CitationPopoverDemo,
  DialogDemo,
  DropdownDemo,
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
import { Disclosure, DisclosureGroup } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  { name: "surface", value: "#FFFFFF", use: "Cards, panels, inputs", className: "bg-surface", bordered: true },
  { name: "surface-sunken", value: "#F3F0E8", use: "Table headers, citation blocks, wells", className: "bg-surface-sunken", bordered: true },
];
const inks = [
  { name: "ink", value: "#161A1D", use: "Primary text · 16.5:1 on paper", className: "bg-ink" },
  { name: "ink-2", value: "#434A50", use: "Secondary text · 8.5:1 on paper", className: "bg-ink-2" },
  { name: "ink-3", value: "#6B737A", use: "Tertiary text, placeholders · 4.5:1 — on paper and surface only", className: "bg-ink-3" },
];
const lines = [
  { name: "line", value: "#E3DED2", use: "Hairlines, card borders", className: "bg-line" },
  { name: "line-strong", value: "#C9C2B2", use: "Dividers that must read, secondary-button outline", className: "bg-line-strong" },
  { name: "line-control", value: "#8A8373", use: "Boundary of inputs, checkboxes, switches · 3.8:1", className: "bg-line-control" },
];
const brand = [
  { name: "brand", value: "#0F5A47", use: "Primary actions, links, active navigation", className: "bg-brand" },
  { name: "brand-hover", value: "#0B4636", use: "Hover and pressed", className: "bg-brand-hover" },
  { name: "brand-tint", value: "#E4F0EA", use: "Selected rows, brand badges", className: "bg-brand-tint", bordered: true },
  { name: "focus", value: "#1F4F8F", use: "Focus ring: 2 px + 2 px offset", className: "bg-focus" },
];
const roles = [
  { name: "accent", value: "#B4690E", use: "Amber for icons, bars, borders (not text)", className: "bg-accent" },
  { name: "accent-ink", value: "#8F5206", use: "Amber for text · 5.5:1 on its tint", className: "bg-accent-ink" },
  { name: "accent-tint", value: "#FBF0DC", use: "Deadline soon, Verify, Evidence needed", className: "bg-accent-tint", bordered: true },
  { name: "danger", value: "#A3271C", use: "Errors, closing, gaps", className: "bg-danger" },
  { name: "danger-tint", value: "#FBE9E6", use: "Danger background", className: "bg-danger-tint", bordered: true },
  { name: "success", value: "#1D6F43", use: "Met requirement, success", className: "bg-success" },
  { name: "success-tint", value: "#E3F3E9", use: "Success background", className: "bg-success-tint", bordered: true },
  { name: "info", value: "#1F4F8F", use: "Informational, planning-stage notices", className: "bg-info" },
  { name: "info-tint", value: "#E6EEF8", use: "Info background", className: "bg-info-tint", bordered: true },
];

const scale = [
  { cls: "text-4xl", role: "type-hero (≥1024 px)", size: "56/58", sample: "Know which contracts", serif: true },
  { cls: "text-3xl", role: "type-h1 · type-hero on phones", size: "40/44", sample: "Know which public contracts", serif: true },
  { cls: "text-2xl", role: "type-h2 · app page title", size: "28/34", sample: "Your radar, already built.", serif: true },
  { cls: "text-xl", role: "type-h3", size: "22/28", sample: "Open tenders like the ones you’ve won", serif: true, medium: true },
  { cls: "text-lg", role: "type-lead", size: "18/28", sample: "Upload a tender pack and get a straight answer." },
  { cls: "text-base", role: "Body", size: "16/24", sample: "Each requirement shows the buyer’s exact words, the file and the page." },
  { cls: "text-sm", role: "Dense UI", size: "14/20", sample: "Calderbrook Borough Council · £1.2m · North West" },
  { cls: "text-13", role: "Small", size: "13/18", sample: "Your cover: £10m, renews 30 Jun 2027" },
  { cls: "text-xs", role: "Micro, chips", size: "12/16", sample: "Closes in 9 days · 22 Nov 2026, 12:00" },
] as const;

/** A button-shaped specimen frozen in one state (the real hover and pressed styles, applied statically). */
function StateChip({ className, children }: { className: string; children: string }) {
  return (
    <span className={`inline-flex h-10 items-center justify-center rounded-control border border-transparent px-4 text-sm font-medium ${className}`}>{children}</span>
  );
}

export default function StyleguidePage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="container-content flex h-14 items-center gap-3">
          <Logo size="sm" />
          <span className="rounded-control bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-2">Design system</span>
          <span className="ml-auto hidden text-13 text-ink-2 sm:inline">
            Source of truth: <Code>docs/design/DESIGN.md</Code>
          </span>
        </div>
      </header>

      <div className="container-content grid gap-x-12 gap-y-8 py-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-12">
        <nav aria-label="Styleguide sections" className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
          <p className="type-eyebrow mb-2 text-ink-2">Contents</p>
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
            <p className="type-eyebrow text-brand">Bidfolio design system</p>
            <h1 className="type-h1 mt-3 text-ink">Styleguide</h1>
            <p className="type-lead mt-4 max-w-reading">
              Tokens, type and every primitive in all its states. Build feature screens from what is on this page; if something you need is missing, add it to{" "}
              <Code>src/components/ui</Code> and show it here.
            </p>
          </header>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="principles"
            title="How to use this"
            lead="Six rules that decide most questions. The reasoning is in DESIGN.md §1."
          >
            <ol className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ["Evidence on the page", "Every claim is one click from its source. A citation is a control, not a tooltip."],
                ["Calm density", "Show a lot, quietly: hierarchy from type and hairlines, not from boxes, colour or shadow."],
                ["Deadlines lead", "Dates get the same treatment and the same position in every card and row."],
                ["Honest machine", "AI output is labelled and editable. Gaps are shown as gaps."],
                ["Not the government", "Warm paper, ink and deep green, and the independence line wherever public data appears."],
                ["Works one-handed", "Everything is usable at 360 px with 40 px targets."],
              ].map(([title, body], index) => (
                <li key={title} className="grid grid-cols-[1.75rem_1fr] gap-x-2 border-t border-line-strong pt-3">
                  <span aria-hidden className="font-display text-lg leading-6 font-medium text-brand tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-base leading-6 font-semibold text-ink">{title}</p>
                    <p className="mt-1 text-sm text-ink-2">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Alert variant="info" role="note">
              <AlertTitle>Colours come from tokens only</AlertTitle>
              <AlertDescription>
                <p>
                  Use <Code>bg-paper</Code>, <Code>text-ink-2</Code>, <Code>border-line</Code> and the shadcn names (<Code>bg-background</Code>,{" "}
                  <Code>text-muted-foreground</Code>, <Code>bg-primary</Code> …), never a hex value or a Tailwind palette colour. Note that <Code>accent</Code> is the
                  amber role here, not a hover grey: for hover and selected surfaces use <Code>bg-muted</Code> or <Code>bg-brand-tint</Code>.
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
                Each token is a utility for background, text and border: <Code>bg-brand</Code>, <Code>text-brand</Code>, <Code>border-brand</Code>. Contrast of every
                pair in use is computed by <Code>node scripts/design/contrast.mjs</Code> and listed in <Code>docs/design/CONTRAST.md</Code>.
              </>
            }
          >
            <Group title="Surfaces">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{surfaces.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Text">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{inks.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Lines" note="Borders do the work in this system. A control’s boundary must reach 3:1, so inputs use line-control; cards and rules use line.">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{lines.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Brand and focus">
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{brand.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group
              title="Status roles"
              note="Each role has a solid and a tint. Text on a tint uses the solid, except amber: accent is too light for text, so amber text is accent-ink."
            >
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{roles.map((token) => <Swatch key={token.name} {...token} />)}</div>
            </Group>
            <Group title="Text on each surface" note="Use ink-3 on paper and surface only. On sunken, the lightest text is ink-2.">
              <div className="grid gap-4 md:grid-cols-3">
                {(["paper", "surface", "sunken"] as const).map((tone) => (
                  <Canvas key={tone} tone={tone}>
                    <p className="text-sm font-medium text-ink">text-ink on {tone}</p>
                    <p className="text-sm text-ink-2">text-ink-2: secondary text</p>
                    {tone === "sunken" ? <p className="text-sm text-ink-2 line-through decoration-danger">text-ink-3: not here</p> : <p className="text-sm text-ink-3">text-ink-3: tertiary text</p>}
                    <p className="mt-2 text-sm">
                      <a href="#colour">A content link</a>
                    </p>
                  </Canvas>
                ))}
              </div>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="type"
            title="Typography"
            lead="Source Serif 4 for headings, Inter for interface and body with tabular figures, IBM Plex Mono for references. Nine sizes; nothing below 12 px. Sentence case everywhere."
          >
            <Group title="Families">
              <div className="grid gap-4 md:grid-cols-3">
                <Canvas tone="surface">
                  <p className="font-display text-2xl font-semibold text-ink">Source Serif 4</p>
                  <p className="mt-1 text-13 text-ink-2">
                    <Code>font-display</Code> · 600 for h1–h2, 500 for h3
                  </p>
                </Canvas>
                <Canvas tone="surface">
                  <p className="text-2xl font-semibold text-ink">Inter 0123456789</p>
                  <p className="mt-1 text-13 text-ink-2">
                    <Code>font-sans</Code> · 400 / 500 / 600 · tnum, cv11
                  </p>
                </Canvas>
                <Canvas tone="surface">
                  <p className="font-mono text-2xl font-medium text-ink">Plex Mono p.14</p>
                  <p className="mt-1 text-13 text-ink-2">
                    <Code>font-mono</Code> · 400 / 500 · references, CPV codes
                  </p>
                </Canvas>
              </div>
            </Group>

            <Group title="Scale" note="The Tailwind size names are remapped, so any text-* class lands on the scale. text-13 is the one added step.">
              <div className="divide-y divide-line border-y border-line">
                {scale.map((step) => (
                  <div key={step.cls} className="grid gap-x-6 gap-y-1 py-4 md:grid-cols-[11rem_minmax(0,1fr)] md:items-baseline">
                    <div>
                      <p className="font-mono text-13 text-ink">{step.cls}</p>
                      <p className="text-xs text-ink-2">
                        {step.size} · {step.role}
                      </p>
                    </div>
                    <p className={`${step.cls} ${"serif" in step && step.serif ? `font-display ${"medium" in step && step.medium ? "font-medium" : "font-semibold"}` : ""} truncate text-ink`}>
                      {step.sample}
                    </p>
                  </div>
                ))}
              </div>
            </Group>

            <Group
              title="Roles"
              note="Use a role class on headings rather than assembling family, size and weight. h1–h3 are serif by default; a heading that is a UI label (a card title) sets font-sans."
            >
              <div className="space-y-5 rounded-card border border-line bg-surface p-6">
                <Specimen label="type-eyebrow · the only all-caps style">
                  <p className="type-eyebrow text-brand">For UK suppliers to the public sector</p>
                </Specimen>
                <Specimen label="type-hero · 40/44, 56/58 from 1024 px">
                  <p className="type-hero text-ink">Know which public contracts are worth your time.</p>
                </Specimen>
                <Specimen label="type-h1 · 28/34 on phones, 40/44 from 640 px">
                  <p className="type-h1 text-ink">Check a tender pack before you spend a week on it.</p>
                </Specimen>
                <Specimen label="type-h2 · 28/34">
                  <p className="type-h2 text-ink">Your radar, already built.</p>
                </Specimen>
                <Specimen label="type-h3 · 22/28, weight 500">
                  <p className="type-h3 text-ink">Contracts ending soon in your trade</p>
                </Specimen>
                <Specimen label="type-lead · 18/28">
                  <p className="type-lead max-w-reading">We have read the award notices. If your company has won a public contract, its page is already here.</p>
                </Specimen>
                <Specimen label="type-reading · 16/28 in a 68-character column (max-w-reading)">
                  <p className="type-reading max-w-reading text-ink">
                    Notice and award information comes from the UK Government’s Find a Tender service. We reproduce and summarise it as published. Always confirm a
                    deadline or requirement in the buyer’s own documents.
                  </p>
                </Specimen>
                <Specimen label="type-ref · references, file names, page numbers">
                  <p className="type-ref text-ink-2">ITT Volume 2 – Terms and Conditions.pdf · page 14 · CPV 90911200</p>
                </Specimen>
              </div>
            </Group>

            <Group title="Figures" note="Inter sets tabular figures everywhere, so columns of numbers align without extra classes. Right-align numeric columns.">
              <div className="grid max-w-xs grid-cols-[1fr_auto] gap-x-6 text-sm text-ink">
                <span className="text-ink-2">Cleaning of council offices</span>
                <span className="text-right">£410,000</span>
                <span className="text-ink-2">Window cleaning framework</span>
                <span className="text-right">£1,180,000</span>
                <span className="text-ink-2">Sheltered housing</span>
                <span className="text-right">£95,111</span>
              </div>
            </Group>

            <Group title="Links">
              <p className="max-w-reading text-base text-ink">
                An anchor without a class is a content link: <a href="#type">brand colour, a thin underline, darker on hover</a>. On an element that carries its own
                classes use{" "}
                <a href="#type" className="link">
                  <Code>link</Code>
                </a>
                ; in navigation and footers use{" "}
                <a href="#type" className="link-quiet text-ink-2">
                  link-quiet
                </a>
                .
              </p>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="layout" title="Space, radius, shadow" lead="Spacing steps: 4, 8, 12, 16, 24, 32, 48, 64, 96 px. Content column 1120 px; reading column 68 characters.">
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
            <Group title="Radius" note="Three steps only. The Tailwind names snap to them: rounded-sm and -md are 4 px, -lg and -xl are 8 px, -2xl and up are 12 px.">
              <Row>
                <Specimen label="rounded-control · 4 px · inputs, buttons, chips">
                  <span className="block h-16 w-28 rounded-control border border-line-strong bg-surface" />
                </Specimen>
                <Specimen label="rounded-card · 8 px · cards, menus">
                  <span className="block h-16 w-28 rounded-card border border-line-strong bg-surface" />
                </Specimen>
                <Specimen label="rounded-modal · 12 px · dialogs, product frames">
                  <span className="block h-16 w-28 rounded-modal border border-line-strong bg-surface" />
                </Specimen>
              </Row>
            </Group>
            <Group title="Shadow" note="Rare. Most surfaces have a hairline and no shadow.">
              <Row className="gap-x-10">
                <Specimen label="none · the default card">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface" />
                </Specimen>
                <Specimen label="shadow-raised · a card that sits above its neighbours">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface shadow-raised" />
                </Specimen>
                <Specimen label="shadow-overlay · popovers, menus, dialogs">
                  <span className="block h-16 w-36 rounded-card border border-line bg-surface shadow-overlay" />
                </Specimen>
              </Row>
            </Group>
            <Group title="Containers">
              <ul className="space-y-1 text-sm text-ink-2">
                <li>
                  <Code>container-content</Code> centres a 1120 px column with 16 / 24 / 32 px gutters. The app shell already wraps every page in it.
                </li>
                <li>
                  <Code>max-w-reading</Code> limits running text to 68 characters; <Code>max-w-content</Code> is the bare 1120 px width.
                </li>
                <li>
                  <Code>hit-40</Code> gives a small control a 40 px hit area without changing how it looks.
                </li>
              </ul>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="brand"
            title="Brand"
            lead="The mark is a folio sheet whose top-left corner is folded over; the gap between the folded flap and the sheet is a tick. One colour. Below 20 px a version drawn for the 16 px grid is used automatically."
          >
            <Group title="Mark">
              <Row className="items-end gap-x-10">
                {[16, 24, 48, 96].map((size) => (
                  <Specimen key={size} label={`${size} px`}>
                    <LogoMark size={size} />
                  </Specimen>
                ))}
                <Specimen label="On brand">
                  <span className="grid size-24 place-items-center rounded-card bg-brand">
                    <LogoMark size={48} className="text-paper" />
                  </span>
                </Specimen>
                <Specimen label="In ink">
                  <LogoMark size={48} className="text-ink" />
                </Specimen>
              </Row>
            </Group>
            <Group title="Lockup" note="Mark + wordmark in Source Serif 4 semibold, sentence case. Keep clear space of at least the width of the mark on every side.">
              <div className="grid gap-4 md:grid-cols-2">
                <Canvas tone="paper" className="flex flex-col items-start gap-5">
                  <Wordmark size="lg" />
                  <Wordmark size="md" />
                  <Wordmark size="sm" />
                </Canvas>
                <Canvas tone="brand" className="flex flex-col items-start gap-5">
                  <Wordmark size="lg" tone="inverse" />
                  <Wordmark size="md" tone="inverse" />
                  <Wordmark size="sm" tone="inverse" />
                </Canvas>
              </div>
            </Group>
            <Group title="Do not">
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2 marker:text-ink-3">
                <li>recolour the mark outside brand, ink and paper, or set it on a photograph;</li>
                <li>use crowns, crests, GOV.UK black and blue, or wording that suggests an official service;</li>
                <li>use emoji, stock illustration or “AI sparkle” icons anywhere in the product.</li>
              </ul>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="buttons" title="Buttons" lead="One primary action per view. 40 px tall by default; small sizes keep a 40 px hit area.">
            <Group title="Variants">
              <Row>
                <Specimen label="default">
                  <Button>Start a bid</Button>
                </Specimen>
                <Specimen label="outline">
                  <Button variant="outline">Save tender</Button>
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
                  <Button variant="link">Open source page</Button>
                </Specimen>
              </Row>
            </Group>
            <Group title="Sizes">
              <Row>
                <Specimen label="lg · 48 px · marketing">
                  <Button size="lg">
                    Find your company <ArrowRight aria-hidden />
                  </Button>
                </Specimen>
                <Specimen label="default · 40 px">
                  <Button>
                    <Upload aria-hidden /> Upload tender pack
                  </Button>
                </Specimen>
                <Specimen label="sm · 32 px">
                  <Button size="sm" variant="outline">
                    <Download aria-hidden /> Export
                  </Button>
                </Specimen>
                <Specimen label="xs · 28 px">
                  <Button size="xs" variant="outline">
                    Apply
                  </Button>
                </Specimen>
                <Specimen label="icon">
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
                    <StateChip className="bg-brand text-white">Start a bid</StateChip>
                  </Specimen>
                  <Specimen label="hover">
                    <StateChip className="bg-brand-hover text-white">Start a bid</StateChip>
                  </Specimen>
                  <Specimen label="pressed">
                    <StateChip className="bg-brand-hover text-white shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]">Start a bid</StateChip>
                  </Specimen>
                  <Specimen label="focus-visible">
                    <StateChip className="bg-brand text-white outline-2 outline-offset-2 outline-focus">Start a bid</StateChip>
                  </Specimen>
                  <Specimen label="disabled">
                    <Button disabled>Start a bid</Button>
                  </Specimen>
                  <Specimen label="loading (click)">
                    <LoadingButtonDemo />
                  </Specimen>
                </Row>
                <Row>
                  <Specimen label="default">
                    <StateChip className="border-line-strong! bg-surface text-ink">Save tender</StateChip>
                  </Specimen>
                  <Specimen label="hover">
                    <StateChip className="border-line-control! bg-surface-sunken text-ink">Save tender</StateChip>
                  </Specimen>
                  <Specimen label="pressed">
                    <StateChip className="border-line-control! bg-line text-ink">Save tender</StateChip>
                  </Specimen>
                  <Specimen label="focus-visible">
                    <StateChip className="border-line-strong! bg-surface text-ink outline-2 outline-offset-2 outline-focus">Save tender</StateChip>
                  </Specimen>
                  <Specimen label="disabled">
                    <Button variant="outline" disabled>
                      Save tender
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
            <Group title="On a brand panel" note="Wrap the panel in .on-brand so that the focus ring and text selection turn white.">
              <Canvas tone="brand">
                <Row>
                  <Specimen label={<span className="text-brand-on-dark">inverse</span>}>
                    <Button variant="inverse">Find your company</Button>
                  </Specimen>
                  <Specimen label={<span className="text-brand-on-dark">inverse-outline</span>}>
                    <Button variant="inverse-outline">Get a free bid check</Button>
                  </Specimen>
                </Row>
              </Canvas>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="forms"
            title="Form controls"
            lead="Label above, helper below, error in danger with an icon and words. 40 px tall; 16 px text on phones so that iOS does not zoom."
          >
            <Group title="Text input: states">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-1">Default</Label>
                  <Input id="sg-in-1" placeholder="Company name or number" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-2">Hover</Label>
                  <Input id="sg-in-2" placeholder="Company name or number" className="border-ink-3" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-3">Focus</Label>
                  <Input id="sg-in-3" defaultValue="Harlow & Finch" className="border-focus outline-2 outline-offset-2 outline-focus" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-4">Filled</Label>
                  <Input id="sg-in-4" defaultValue="Harlow & Finch Facilities Ltd" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-5">Disabled</Label>
                  <Input id="sg-in-5" defaultValue="olivia@harlowfinch.example" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sg-in-6">Read-only</Label>
                  <Input id="sg-in-6" defaultValue="Company no. as published" readOnly />
                </div>
              </div>
            </Group>

            <Group title="Field with helper and error" note="FormField wires the label, aria-describedby and aria-invalid for you. Validate on blur and on submit.">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <FormField label="Public liability cover" name="sg-cover" defaultValue="£10,000,000" hint="The limit for any one claim, as stated on your certificate." />
                <FormField label="Policy renewal date" name="sg-renewal" defaultValue="31/02/2027" error="Enter a real date, for example 30 06 2027." />
              </div>
              <div className="mt-5 max-w-md">
                <FormError message="We could not save your changes. Check your connection and try again." />
              </div>
            </Group>

            <Group title="Textarea, select and file">
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sg-ta">Note</Label>
                  <Textarea id="sg-ta" placeholder="Why this requirement is met, or what is missing" aria-describedby="sg-ta-hint" />
                  <FieldHint id="sg-ta-hint">Visible to everyone in the workspace.</FieldHint>
                </div>
                <div className="space-y-5">
                  <div className="space-y-1.5">
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
                        <FieldError className="mt-1.5">Choose a region.</FieldError>
                      </div>
                    </Specimen>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="sg-file">File</Label>
                  <Input id="sg-file" type="file" className="max-w-md py-0" />
                </div>
              </div>
            </Group>

            <Group title="Checkbox, radio and switch" note="20 px controls with a 40 px hit area. The label is always clickable.">
              <ChoiceDemo />
            </Group>

            <Group title="Live count against a limit">
              <WordCountDemo />
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="badges" title="Badges and chips" lead="4 px radius, 12/16 medium, tinted. The words carry the meaning; colour and icon support them.">
            <Group title="Variants">
              <Row>
                {(["default", "brand", "secondary", "outline", "success", "warning", "destructive", "info"] as const).map((variant) => (
                  <Specimen key={variant} label={variant}>
                    <Badge variant={variant}>{variant === "default" ? "Recommended" : variant.charAt(0).toUpperCase() + variant.slice(1)}</Badge>
                  </Specimen>
                ))}
              </Row>
            </Group>
            <Group title="Deadline chip" note="Relative time + absolute date, always both. More than 14 days: neutral. 4 to 14 days: amber. 3 days or fewer: danger. Closed: struck neutral.">
              <Row>
                <Specimen label="> 14 days · secondary">
                  <Badge variant="secondary">
                    <Clock aria-hidden /> Closes in 21 days · 4 Dec 2026, 17:00
                  </Badge>
                </Specimen>
                <Specimen label="4–14 days · warning">
                  <Badge variant="warning">
                    <Clock aria-hidden /> Closes in 9 days · 22 Nov 2026, 12:00
                  </Badge>
                </Specimen>
                <Specimen label="≤ 3 days · destructive">
                  <Badge variant="destructive">
                    <Clock aria-hidden /> Closes in 2 days · 15 Nov 2026, 12:00
                  </Badge>
                </Specimen>
                <Specimen label="closed · secondary, struck">
                  <Badge variant="secondary" className="line-through">
                    Closed · 6 Nov 2026, 12:00
                  </Badge>
                </Specimen>
              </Row>
            </Group>
            <Group title="Notice type">
              <Row>
                <Specimen label="brand">
                  <Badge variant="brand">Tender</Badge>
                </Specimen>
                <Specimen label="info">
                  <Badge variant="info">Early notice</Badge>
                </Specimen>
                <Specimen label="success">
                  <Badge variant="success">Award</Badge>
                </Specimen>
                <Specimen label="secondary">
                  <Badge variant="secondary">Below-threshold</Badge>
                </Specimen>
                <Specimen label="outline">
                  <Badge variant="outline">Framework</Badge>
                </Specimen>
              </Row>
            </Group>
            <Group title="Requirement status" note="Icon + word. Never colour alone.">
              <Row>
                <Specimen label="success">
                  <Badge variant="success">
                    <CircleCheck aria-hidden /> Met
                  </Badge>
                </Specimen>
                <Specimen label="destructive">
                  <Badge variant="destructive">
                    <CircleAlert aria-hidden /> Gap
                  </Badge>
                </Specimen>
                <Specimen label="warning">
                  <Badge variant="warning">
                    <CircleHelp aria-hidden /> Verify
                  </Badge>
                </Specimen>
                <Specimen label="secondary">
                  <Badge variant="secondary">
                    <CircleDashed aria-hidden /> Unknown
                  </Badge>
                </Specimen>
              </Row>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="alerts"
            title="Alerts"
            lead={
              <>
                For things a person must read on the page. The default role is <Code>alert</Code>; pass <Code>role=&quot;status&quot;</Code> or{" "}
                <Code>role=&quot;note&quot;</Code> when it should not interrupt a screen reader.
              </>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Alert role="note">
                <AlertTitle>AI-assisted analysis</AlertTitle>
                <AlertDescription>
                  <p>Check it against the tender documents. You remain responsible for your submission.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="info" role="note">
                <AlertTitle>Early notice</AlertTitle>
                <AlertDescription>
                  <p>The buyer is planning this procurement. There is nothing to bid for yet.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="success" role="status">
                <AlertTitle>Biddable</AlertTitle>
                <AlertDescription>
                  <p>You meet all 12 pass/fail requirements we found.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="warning" role="status">
                <AlertTitle>Biddable with gaps</AlertTitle>
                <AlertDescription>
                  <p>You meet 9 of 12 pass/fail requirements. 2 gaps to close, 1 to verify.</p>
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Likely not eligible</AlertTitle>
                <AlertDescription>
                  <p>The pack requires a turnover of £5m in each of the last two years. Your company facts show £1.4m.</p>
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
          <GuideSection id="surfaces" title="Cards and feedback" lead="A card is a white surface with a hairline and an 8 px radius. No shadow unless it must sit above its neighbours.">
            <Group title="Card">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Company facts</CardTitle>
                    <CardDescription>Confirmed by you. Used to check requirements and to draft answers.</CardDescription>
                    <CardAction>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                      <dt className="text-ink-2">Public liability</dt>
                      <dd className="text-right text-ink">£10m</dd>
                      <dt className="text-ink-2">Turnover, last year</dt>
                      <dd className="text-right text-ink">£1.4m</dd>
                      <dt className="text-ink-2">Employees</dt>
                      <dd className="text-right text-ink">38</dd>
                    </dl>
                  </CardContent>
                  <CardFooter className="border-t border-line">
                    <span className="text-13 text-ink-2">Last confirmed 2 Nov 2026</span>
                  </CardFooter>
                </Card>
                <Card raised>
                  <CardHeader>
                    <CardTitle>Raised card</CardTitle>
                    <CardDescription>
                      <Code>{"<Card raised>"}</Code> adds the small shadow. Use it for the one card that leads, such as the recommended plan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Separator />
                    <p className="mt-4 text-sm text-ink-2">
                      Hairline rules (<Code>Separator</Code>) divide content inside a card. Use <Code>strong</Code> for a rule that must read.
                    </p>
                    <Separator strong className="mt-4" />
                  </CardContent>
                </Card>
              </div>
            </Group>
            <Group title="Progress" note="Always next to the number it represents.">
              <div className="grid max-w-xl gap-4">
                {(
                  [
                    ["brand", 40, "2 of 5 bids used"],
                    ["warning", 92, "460 / 500 words"],
                    ["danger", 100, "3 of 3 seats in use · limit reached"],
                    ["success", 100, "12 of 12 requirements met"],
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
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-ink-2">
                  <Spinner label="Reading files" /> Reading files…
                </div>
              </div>
            </Group>
            <Group title="Avatar">
              <Row>
                <Specimen label="sm">
                  <Avatar size="sm">
                    <AvatarFallback>O</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="default">
                  <Avatar>
                    <AvatarFallback>OH</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="lg">
                  <Avatar size="lg">
                    <AvatarFallback>OH</AvatarFallback>
                  </Avatar>
                </Specimen>
                <Specimen label="group">
                  <AvatarGroup>
                    <Avatar>
                      <AvatarFallback>OH</AvatarFallback>
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
            <Group title="Tabs" note="Underline style. For sections that are separate pages, use links styled with tabListClasses and tabTriggerClasses (see SettingsNav).">
              <TabsDemo />
            </Group>
            <Group title="Breadcrumb" note="The app’s top bar derives it from the URL. A page whose URL contains an id names itself with BreadcrumbTrail (see Page patterns).">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#navigation">Bids</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#navigation">Civic buildings cleaning</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Brief</BreadcrumbPage>
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
            <Group title="Disclosure" note="Native details/summary: works without JavaScript, findable with in-page search, prints open.">
              <DisclosureGroup className="max-w-2xl">
                <Disclosure summary="Is my tender pack kept private?">
                  <p>Yes. Files you upload are your confidential data. Only members of your workspace can open them.</p>
                </Disclosure>
                <Disclosure summary="Does AI write my bid?" open>
                  <p>It writes first drafts, only from your own evidence, and you stay in control.</p>
                </Disclosure>
              </DisclosureGroup>
            </Group>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection
            id="tables"
            title="Tables"
            lead="Sticky header on a sunken band, no zebra, row hover in brand tint, numeric columns right-aligned. On phones, prefer a list of cards to a table with more than three columns."
          >
            <Table framed containerClassName="max-h-80">
              <TableCaption>Awards published on Find a Tender. Values as published by the buyer.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Awarded</TableHead>
                  <TableHead numeric>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Cleaning of council offices", "Calderbrook Borough Council", "14 Mar 2023", "£410,000"],
                  ["Window cleaning, schools", "Northmere County Council", "2 Sep 2023", "£180,000"],
                  ["Communal cleaning, sheltered housing", "Tidewell Housing Association", "21 Jan 2024", "£95,000"],
                  ["Caretaking, civic centre", "Calderbrook Borough Council", "8 Jul 2024", "£1,240,000"],
                  ["Deep cleaning call-off", "Marlow Heath Academy Trust", "30 Oct 2024", "Value not published"],
                  ["Leisure centres and libraries", "Wexcombe District Council", "11 Feb 2025", "£640,000"],
                  ["Office cleaning, depot", "Northmere County Council", "19 May 2025", "£72,500"],
                ].map((row, index) => {
                  const [title = "", buyer = "", date = "", value = ""] = row;
                  return (
                  <TableRow key={title} data-state={index === 3 ? "selected" : undefined}>
                    <TableCell className="font-medium text-ink">{title}</TableCell>
                    <TableCell className="text-ink-2">{buyer}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-2 tabular-nums">{date}</TableCell>
                    <TableCell numeric className={value.startsWith("£") ? "text-ink" : "text-ink-2"}>
                      {value}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-13 text-ink-2">
              The fourth row is selected (<Code>data-state=&quot;selected&quot;</Code>). Scroll inside the table: the header stays.
            </p>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="overlays" title="Overlays" lead="White surface, hairline, overlay shadow. 8 px radius for menus and popovers, 12 px for dialogs. Escape closes all of them and focus returns to the trigger.">
            <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
              <Group title="Popover: the citation" note="Citations are a first-class control: click the reference to read the verbatim quote with its file and page.">
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
          <GuideSection id="patterns" title="Page patterns" lead="The app shell gives every page a top bar with breadcrumbs, a 1120 px container and the navigation. A page supplies a PageHeader and its content.">
            <Group title="Page header">
              <Canvas tone="paper">
                <PageHeader
                  eyebrow="Calderbrook Borough Council"
                  title="Cleaning and caretaking services for civic buildings 2027–2030"
                  description="Uploaded 13 Nov 2026 · 6 files · 214 pages"
                  meta={
                    <>
                      <Badge variant="brand">Tender</Badge>
                      <Badge variant="warning">
                        <Clock aria-hidden /> Closes in 9 days · 22 Nov 2026, 12:00
                      </Badge>
                    </>
                  }
                  actions={
                    <>
                      <Button variant="outline">Export</Button>
                      <Button>Draft answers</Button>
                    </>
                  }
                />
              </Canvas>
              <div className="mt-4">
                <Snippet>{`<PageHeader
  eyebrow={bid.buyer}
  title={bid.title}
  description="Uploaded 13 Nov 2026 · 6 files · 214 pages"
  meta={<DeadlineChip closesAt={bid.closesAt} />}
  actions={<Button>Draft answers</Button>}
/>

// A page whose URL contains an id names itself in the top bar:
<BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.title }]} />`}</Snippet>
              </div>
            </Group>
            <Group title="Section and empty state" note="One sentence about what belongs here, one action, optionally an example. No illustration.">
              <Canvas tone="paper">
                <PageSection title="Documents" description="Policies, case studies, past bids and certificates your drafts are written from." action={<Button variant="outline">Upload</Button>}>
                  <EmptyState
                    title="No documents yet"
                    description="Upload the documents you reuse in bids. Drafts are written only from what is in your library."
                    action={
                      <Button>
                        <Upload aria-hidden /> Upload documents
                      </Button>
                    }
                    example={
                      <>
                        <span className="font-medium text-ink">For example:</span> a health and safety policy, your insurance certificates, two case studies and the last
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
            lead="The domain components (DeadlineChip, Money, NoticeBadge, StatBlock, CitationMark …) live in the feature modules. These are the treatments they should share."
          >
            <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
              <Group title="Stat block" note="Big tabular number in the display serif, a label, one line of context.">
                <div className="grid grid-cols-3 gap-4 rounded-card border border-line bg-surface p-5">
                  {[
                    ["14", "Contracts won", "Since 2021"],
                    ["£3.2m", "Award value", "As published"],
                    ["6", "Public buyers", "4 councils"],
                  ].map(([value, label, context]) => (
                    <div key={label}>
                      <p className="font-display text-2xl leading-8 font-semibold text-ink tabular-nums">{value}</p>
                      <p className="text-13 font-medium text-ink">{label}</p>
                      <p className="text-xs text-ink-2">{context}</p>
                    </div>
                  ))}
                </div>
              </Group>
              <Group title="Money" note="Rounded for reading, exact on hover and focus; never £0 for an unknown value.">
                <ul className="space-y-1 text-sm text-ink">
                  <li>
                    <span className="tabular-nums">£102k</span> <span className="text-ink-2">· exact figure in a Tooltip: £101,950</span>
                  </li>
                  <li>
                    <span className="tabular-nums">£1.2m</span> <span className="text-ink-2">· one decimal place above a million</span>
                  </li>
                  <li>
                    <span className="text-ink-2">Value not published</span> <span className="text-ink-2">· in ink-2, in words</span>
                  </li>
                </ul>
              </Group>
              <Group title="Citation mark" note="Mono, 12 px, brand on brand-tint. Hollow and dashed when the quote could not be matched to the source text.">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="type-ref inline-flex items-center rounded-control border border-brand/25 bg-brand-tint px-1.5 py-0.5 font-medium text-brand">Spec p.14</span>
                  <span className="type-ref inline-flex items-center gap-1 rounded-control border border-dashed border-accent bg-surface px-1.5 py-0.5 font-medium text-accent-ink">
                    <span aria-hidden className="size-1.5 rounded-full border border-current" />
                    SQ p.11
                  </span>
                  <span className="text-13 text-accent-ink">Verify in documents</span>
                </div>
              </Group>
              <Group title="Evidence needed" note="A gap in a draft is highlighted on accent-tint and says what is missing.">
                <p className="max-w-md rounded-card border border-line bg-paper p-4 font-display text-base leading-6 text-ink">
                  Every transferring employee keeps their existing terms.{" "}
                  <mark className="rounded-xs box-decoration-clone px-1 py-0.5">
                    <span className="font-sans text-xs font-semibold text-accent-ink">Evidence needed: </span>number of staff transferred on a previous contract.
                  </mark>
                </p>
              </Group>
              <Group title="Upgrade notice" note="Inline, never a modal trap: what is locked, what the plan includes, the price, one button.">
                <div className="rounded-card border border-line bg-surface p-5">
                  <p className="text-base leading-6 font-semibold text-ink">Drafting is part of Bid Desk</p>
                  <p className="mt-1 text-sm text-ink-2">Your check is ready. To draft and mark the 4 scored questions, start a full bid: 3 a month on Bid Desk, or one with a Bid Pass.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button>Start Bid Desk · £149 a month</Button>
                    <Button variant="outline">Buy a Bid Pass · £99</Button>
                  </div>
                </div>
              </Group>
              <Group title="Data attribution" note="On every page that shows public data.">
                <p className="max-w-md text-13 text-ink-2">
                  Contains public sector information licensed under the <a href="#domain">Open Government Licence v3.0</a>. Bidfolio is an independent service and is not
                  affiliated with, or endorsed by, the UK Government. <a href="#domain">Request a correction or removal</a>.
                </p>
              </Group>
            </div>
          </GuideSection>

          {/* ------------------------------------------------------------------ */}
          <GuideSection id="accessibility" title="Accessibility" lead="The bar is WCAG 2.2 AA. These are the parts the primitives cannot do for you.">
            <ul className="grid gap-x-8 gap-y-4 text-sm text-ink-2 sm:grid-cols-2">
              {[
                ["Focus", "Never remove the focus ring. It is global: 2 px, focus colour, 2 px offset. Inside clipped containers use -outline-offset-2."],
                ["Targets", "40 px minimum on touch. Small controls use hit-40."],
                ["Colour", "Status is always icon + words. Check any new text and background pair with scripts/design/contrast.mjs."],
                ["Headings", "One h1 per page (PageHeader). Sections are h2, groups h3. Do not skip levels for size: use the type roles."],
                ["Live regions", "Processing updates: aria-live=\"polite\". Errors that need attention: role=\"alert\"."],
                ["Motion", "State changes only, 120 to 180 ms, ease-out. prefers-reduced-motion is honoured globally."],
                ["Dates", "Always include the absolute date and time next to a relative one, for print and for screen readers."],
                ["Print", "Public pages and legal documents print as documents: mark chrome with data-print=\"hide\"."],
              ].map(([title, body]) => (
                <li key={title} className="border-t border-line pt-3">
                  <span className="block text-base leading-6 font-semibold text-ink">{title}</span>
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
