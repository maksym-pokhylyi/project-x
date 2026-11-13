"use client";

import { ChevronDown, Copy, LogOut, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FieldError, FieldHint } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.setTimeout(() => setLoading(false), 1800);
      }}
    >
      {loading ? "Saving…" : "Save changes"}
    </Button>
  );
}

export function SelectDemo({ invalid = false, disabled = false }: { invalid?: boolean; disabled?: boolean }) {
  return (
    <Select defaultValue={invalid ? undefined : "north-west"} disabled={disabled}>
      <SelectTrigger className="w-56" aria-label="Region" aria-invalid={invalid || undefined}>
        <SelectValue placeholder="Choose a region" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>England</SelectLabel>
          <SelectItem value="north-west">North West</SelectItem>
          <SelectItem value="yorkshire">Yorkshire and the Humber</SelectItem>
          <SelectItem value="london">London</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Rest of the UK</SelectLabel>
          <SelectItem value="scotland">Scotland</SelectItem>
          <SelectItem value="wales">Wales</SelectItem>
          <SelectItem value="northern-ireland">Northern Ireland</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function ChoiceDemo() {
  const [daily, setDaily] = useState(true);
  return (
    <div className="grid gap-8 sm:grid-cols-3">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ink">Checkbox</legend>
        <div className="flex items-center gap-2.5">
          <Checkbox id="sg-check-1" defaultChecked />
          <Label htmlFor="sg-check-1">Tenders</Label>
        </div>
        <div className="flex items-center gap-2.5">
          <Checkbox id="sg-check-2" />
          <Label htmlFor="sg-check-2">Early notices</Label>
        </div>
        <div className="flex items-center gap-2.5">
          <Checkbox id="sg-check-3" checked="indeterminate" onCheckedChange={() => undefined} />
          <Label htmlFor="sg-check-3">Some regions</Label>
        </div>
        <div className="flex items-center gap-2.5">
          <Checkbox id="sg-check-4" disabled defaultChecked />
          <Label htmlFor="sg-check-4">Disabled</Label>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="sg-check-5" aria-invalid aria-describedby="sg-check-5-error" />
            <Label htmlFor="sg-check-5">I confirm these facts are correct</Label>
          </div>
          <FieldError id="sg-check-5-error" className="mt-1.5">
            Confirm the facts before you continue.
          </FieldError>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">Radio group</legend>
        <RadioGroup defaultValue="weekly" aria-label="Digest frequency">
          <div className="flex items-center gap-2.5">
            <RadioGroupItem value="daily" id="sg-radio-1" />
            <Label htmlFor="sg-radio-1">Daily digest</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <RadioGroupItem value="weekly" id="sg-radio-2" />
            <Label htmlFor="sg-radio-2">Weekly digest</Label>
          </div>
          <div className="flex items-center gap-2.5">
            <RadioGroupItem value="off" id="sg-radio-3" disabled />
            <Label htmlFor="sg-radio-3">Off (disabled)</Label>
          </div>
        </RadioGroup>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-ink">Switch</legend>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sg-switch-1">Deadline reminders</Label>
          <div className="flex items-center gap-2">
            <span className="text-13 text-ink-2" aria-hidden>
              {daily ? "On" : "Off"}
            </span>
            <Switch id="sg-switch-1" checked={daily} onCheckedChange={setDaily} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sg-switch-2">Buyer watchlist alerts</Label>
          <Switch id="sg-switch-2" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sg-switch-3">Disabled</Label>
          <Switch id="sg-switch-3" disabled />
        </div>
      </fieldset>
    </div>
  );
}

export function TabsDemo() {
  return (
    <Tabs defaultValue="open">
      <TabsList aria-label="On this supplier page">
        <TabsTrigger value="open">
          Open tenders <TabsCount>4</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="wins">
          Your wins <TabsCount>14</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="rivals">
          Rival contracts ending <TabsCount>4</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="buyers">
          Buyers in your trade <TabsCount>5</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="open" className="text-sm text-ink-2">
        Open tenders like your past work, soonest deadline first. Arrow keys move between tabs.
      </TabsContent>
      <TabsContent value="wins" className="text-sm text-ink-2">
        From contract award notices that name your company.
      </TabsContent>
      <TabsContent value="rivals" className="text-sm text-ink-2">
        Work like yours, held by someone else, ending within 12 months.
      </TabsContent>
      <TabsContent value="buyers" className="text-sm text-ink-2">
        Public bodies that award work like yours.
      </TabsContent>
    </Tabs>
  );
}

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this bid?</DialogTitle>
          <DialogDescription>The tender pack, the check and every draft will be deleted. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive">Delete bid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Filter chips as above the requirements list of a bid brief: toggle buttons, one pressed. */
export function FilterChipDemo() {
  const filters = [
    { id: "all", label: "All", count: 23 },
    { id: "gaps", label: "Gaps", count: 2 },
    { id: "confirm", label: "To confirm", count: 2 },
    { id: "met", label: "Met", count: 19 },
  ] as const;
  const [selected, setSelected] = useState<(typeof filters)[number]["id"]>("all");
  return (
    <FilterChipGroup aria-label="Filter requirements">
      {filters.map((filter) => (
        <FilterChip key={filter.id} pressed={selected === filter.id} count={filter.count} onClick={() => setSelected(filter.id)}>
          {filter.label}
        </FilterChip>
      ))}
    </FilterChipGroup>
  );
}

/** A source marker in a draft: the small numbered reference that opens the passage it rests on. */
export function CitationPopoverDemo() {
  return (
    <p className="max-w-md text-15 leading-[1.6] text-ink">
      On our current responsive repairs contract we attended 96.2% of emergency call-outs within two hours across 4,180 jobs in 2025–26.{" "}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hit-40 inline-flex min-w-5 items-center justify-center rounded-[3px] bg-brand-tint px-1 font-mono text-xs leading-5 font-medium text-brand transition-colors hover:bg-brand-mark data-[state=open]:bg-brand data-[state=open]:text-white"
            aria-label="Source 3: KPI report Q4 2025-26.pdf, page 3"
          >
            3
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <p className="text-13 font-semibold text-ink">From your documents</p>
          <blockquote className="type-quote mt-2 text-ink">
            &ldquo;Emergency attendance within 2 hours: 96.2% (4,021 of 4,180 jobs), year to 31 March 2026.&rdquo;
          </blockquote>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-3">
            <span className="type-ref text-ink-2">KPI report Q4 2025-26.pdf · p. 3</span>
            <a href="#overlays" className="link text-13 font-medium">
              Open the page
            </a>
          </div>
        </PopoverContent>
      </Popover>
    </p>
  );
}

export function TooltipDemo() {
  return (
    <div className="flex items-center gap-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-sm text-sm font-medium text-ink underline decoration-ink-2 decoration-dotted underline-offset-4">
            £102k
          </button>
        </TooltipTrigger>
        <TooltipContent>£101,950 as published</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Copy link">
            <Copy aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy link</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DropdownDemo() {
  const [saved, setSaved] = useState(true);
  return (
    <div className="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Actions <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>This bid</DropdownMenuLabel>
          <DropdownMenuItem>
            <Pencil aria-hidden /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={saved} onCheckedChange={setSaved}>
            Saved to radar
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem disabled>
            <LogOut aria-hidden /> Export to Word (no answers yet)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 aria-hidden /> Delete bid
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Save</DropdownMenuItem>
          <DropdownMenuItem>Dismiss</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => toast.success("Tender saved to your radar.")}>
        Success
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast.error("The file could not be uploaded.", { description: "It is larger than 50 MB. Split it and try again." })}>
        Error
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast.warning("This accreditation expires in 14 days.")}>
        Warning
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast.info("The pack is being read. You can leave this page.")}>
        Info
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toast("Tender dismissed.", { action: { label: "Undo", onClick: () => toast.success("Tender restored.") } })}
      >
        With action
      </Button>
    </div>
  );
}

/** Live word count against a limit: neutral, amber from 90%, danger over the limit. */
export function WordCountDemo() {
  const limit = 60;
  const [text, setText] = useState(
    "We will mobilise in six weeks, led by our Operations Manager, who has run eleven council mobilisations since 2019. A dated plan covers staff consultation, site surveys, key holding and the first-day checks at each of the nine buildings. Every transferring employee is offered a one-to-one meeting within ten working days.",
  );
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ratio = words / limit;
  const tone = ratio > 1 ? "danger" : ratio >= 0.9 ? "warning" : "brand";
  return (
    <div className="max-w-xl space-y-2">
      <Label htmlFor="sg-answer">Answer (limit {limit} words)</Label>
      <Textarea id="sg-answer" value={text} onChange={(event) => setText(event.target.value)} aria-describedby="sg-answer-count" className="font-display md:text-base md:leading-6" />
      <div className="flex items-center gap-3">
        <Progress value={Math.min(100, ratio * 100)} tone={tone} aria-hidden />
        <span
          id="sg-answer-count"
          aria-live="polite"
          className={`shrink-0 text-13 font-medium tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-accent-ink" : "text-ink-2"}`}
        >
          {words} / {limit} words{tone === "danger" ? " · over the limit" : ""}
        </span>
      </div>
      <FieldHint>Type in the box: the count turns amber at 90% of the limit and red when it is over.</FieldHint>
    </div>
  );
}
