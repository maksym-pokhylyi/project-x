"use client";

import { ChevronDown, Copy, LogOut, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FieldError, FieldHint } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    <Tabs defaultValue="matches">
      <TabsList aria-label="Radar views">
        <TabsTrigger value="matches">
          Matches <TabsCount>12</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="ending">
          Ending soon <TabsCount>5</TabsCount>
        </TabsTrigger>
        <TabsTrigger value="buyers">Buyers</TabsTrigger>
        <TabsTrigger value="early">Early signals</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="matches" className="text-sm text-ink-2">
        Open tenders like the ones you have won. Arrow keys move between tabs.
      </TabsContent>
      <TabsContent value="ending" className="text-sm text-ink-2">
        Contracts held by other suppliers that end in the next twelve months.
      </TabsContent>
      <TabsContent value="buyers" className="text-sm text-ink-2">
        Buyers that award in your trade.
      </TabsContent>
      <TabsContent value="early" className="text-sm text-ink-2">
        Planning-stage notices.
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

/** The citation pattern: a small reference that opens the verbatim quote with file and page. */
export function CitationPopoverDemo() {
  return (
    <p className="max-w-md text-sm text-ink">
      Public liability insurance of at least £10m for any one claim{" "}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="type-ref hit-40 inline-flex items-center rounded-control border border-brand/25 bg-brand-tint px-1.5 py-0.5 font-medium text-brand hover:border-brand data-[state=open]:border-brand"
            aria-label="Citation: Terms and Conditions, page 14"
          >
            T&amp;Cs p.14
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <p className="type-eyebrow text-ink-2">Quoted from the buyer&apos;s documents</p>
          <blockquote className="mt-2 rounded-control border-l-2 border-brand bg-surface-sunken px-3 py-2 font-display text-base leading-6 text-ink">
            &ldquo;The Supplier shall maintain Public Liability insurance of not less than £10,000,000 for any one claim.&rdquo;
          </blockquote>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="type-ref text-ink-2">ITT Volume 2 – Terms and Conditions.pdf · page 14</span>
            <a href="#overlays" className="link text-13 font-medium">
              Open source page
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
          <button type="button" className="rounded-sm text-sm font-medium text-ink underline decoration-ink-3 decoration-dotted underline-offset-4">
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
