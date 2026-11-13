"use client";

import { Banknote, BadgeCheck, BriefcaseBusiness, FileText, ListChecks, Pencil, Plus, Scale, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { NativeSelect } from "@/components/forms/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addRequirementAction,
  deleteRequirementAction,
  recheckCompanyAction,
  setRequirementCheckedAction,
  updateRequirementAction,
} from "@/features/bids/actions";
import {
  COMPANY_STATUSES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_KIND_LABELS,
  REQUIREMENT_KINDS,
  type Citation,
  type CompanyStatus,
  type Provenance,
  type RequirementCategory,
  type RequirementKind,
} from "@/features/bids/types";
import { cn } from "@/lib/utils";
import { CitationMark, type SourceLinks } from "./citation";
import { Pill, StatusPill } from "./ui";

export type RequirementItem = {
  id: string;
  ref: string;
  category: RequirementCategory;
  text: string;
  threshold: string | null;
  kind: RequirementKind;
  isPassFail: boolean;
  evidenceToProvide: string | null;
  citation: Citation | null;
  companyStatus: CompanyStatus;
  companyNote: string | null;
  note: string | null;
  checked: boolean;
  provenance: Provenance | null;
  source: string;
};

const CATEGORY_ICONS: Record<RequirementCategory, LucideIcon> = {
  insurance: ShieldCheck,
  financial: Banknote,
  accreditation: BadgeCheck,
  experience: BriefcaseBusiness,
  policy: FileText,
  legal: Scale,
  other: ListChecks,
};

type Filter = "all" | "pass_fail" | "gaps" | "verify" | "unchecked";

const FILTERS: Array<{ key: Filter; label: string; test: (item: RequirementItem) => boolean }> = [
  { key: "all", label: "All", test: () => true },
  { key: "pass_fail", label: "Pass/fail", test: (item) => item.isPassFail },
  { key: "gaps", label: "Gaps", test: (item) => item.companyStatus === "gap" },
  { key: "verify", label: "To verify", test: (item) => item.companyStatus === "verify" || Boolean(item.citation && !item.citation.verified) },
  { key: "unchecked", label: "Not yet checked by you", test: (item) => !item.checked },
];

function provenanceLabel(item: RequirementItem): { text: string; hint: string } | null {
  if (item.source === "user") return { text: "Added by you", hint: "This requirement was added by hand." };
  const passes = item.provenance?.passes ?? [];
  if (passes.length >= 2) return { text: `Found by ${passes.length} readings`, hint: "Independent readings of the pack agree on this requirement." };
  if (passes.length === 1) return { text: "Found by 1 reading", hint: "Only one of the readings of the pack found this — worth an extra look." };
  return null;
}

type Editing = { mode: "add" } | { mode: "edit"; item: RequirementItem } | null;

/**
 * RequirementRow + the compliance matrix. Every row shows what the tender asks, how
 * binding it is, the verbatim source, the workspace's position against it and a tick the
 * user sets once they have checked it in the documents themselves.
 */
export function RequirementsView({
  bidId,
  requirements,
  links,
  readOnly = false,
  factsConfirmed = true,
  compact = false,
}: {
  bidId: string;
  requirements: RequirementItem[];
  links: SourceLinks;
  readOnly?: boolean;
  factsConfirmed?: boolean;
  /** Brief tab: no filters or editing, just the rows. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Ticks show at once; the server confirms in the background (and a failure puts them back).
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => requirements.filter(FILTERS.find((entry) => entry.key === filter)!.test), [requirements, filter]);
  const passFail = requirements.filter((item) => item.isPassFail);
  const passFailChecked = passFail.filter((item) => ticks[item.id] ?? item.checked).length;

  const run = (work: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) setError(result.error?.message ?? "Something went wrong.");
      else router.refresh();
    });

  return (
    <div className="space-y-5" data-testid="requirements-view">
      {!compact ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter requirements" className="flex flex-wrap gap-1.5">
            {FILTERS.map((entry) => {
              const count = requirements.filter(entry.test).length;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={filter === entry.key}
                  onClick={() => setFilter(entry.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === entry.key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {entry.label} <span className="tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
          {!readOnly ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => recheckCompanyAction(bidId))}>
                Re-check against company facts
              </Button>
              <Button size="sm" onClick={() => setEditing({ mode: "add" })}>
                <Plus aria-hidden className="size-3.5" />
                Add requirement
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!compact && passFail.length > 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="passfail-progress">
          <span className="font-medium text-foreground tabular-nums">
            {passFailChecked} of {passFail.length}
          </span>{" "}
          pass/fail requirements checked against the documents by you. Tick each one once you have read its source.
        </p>
      ) : null}
      {!compact && !factsConfirmed && !readOnly ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Your company facts are not confirmed yet, so every requirement shows as “Unknown”.{" "}
          <a href="/app/library" className="font-medium underline underline-offset-4">
            Confirm your company facts
          </a>
          , then use “Re-check against company facts”.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {REQUIREMENT_CATEGORIES.map((category) => {
        const rows = visible.filter((item) => item.category === category);
        if (rows.length === 0) return null;
        const Icon = CATEGORY_ICONS[category];
        return (
          <section key={category} aria-label={REQUIREMENT_CATEGORY_LABELS[category]}>
            <h3 className="flex items-center gap-2 border-b pb-1.5 text-sm font-semibold">
              <Icon aria-hidden className="size-4 text-muted-foreground" />
              {REQUIREMENT_CATEGORY_LABELS[category]}
              <span className="font-normal text-muted-foreground tabular-nums">{rows.length}</span>
            </h3>
            <ul className="divide-y">
              {rows.map((item) => (
                <RequirementRow
                  key={item.id}
                  item={{ ...item, checked: ticks[item.id] ?? item.checked }}
                  links={links}
                  readOnly={readOnly}
                  pending={pending}
                  onToggleChecked={(checked) => {
                    setTicks((current) => ({ ...current, [item.id]: checked }));
                    startTransition(async () => {
                      const result = await setRequirementCheckedAction(bidId, item.id, checked);
                      if (!result.ok) {
                        setTicks((current) => ({ ...current, [item.id]: !checked }));
                        setError(result.error.message);
                      }
                    });
                  }}
                  onEdit={() => setEditing({ mode: "edit", item })}
                  onDelete={() => {
                    if (window.confirm(`Delete requirement ${item.ref}? This cannot be undone.`)) run(() => deleteRequirementAction(bidId, item.id));
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {requirements.length === 0
            ? "No requirements were found in this pack. Check the documents, or add requirements by hand."
            : "No requirements match this filter."}
        </p>
      ) : null}

      {editing ? (
        <RequirementDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            const result = editing.mode === "add" ? await addRequirementAction(bidId, values) : await updateRequirementAction(bidId, editing.item.id, values);
            if (result.ok) {
              setEditing(null);
              router.refresh();
              return null;
            }
            return result.error.message;
          }}
        />
      ) : null}
    </div>
  );
}

function RequirementRow({
  item,
  links,
  readOnly,
  pending,
  onToggleChecked,
  onEdit,
  onDelete,
}: {
  item: RequirementItem;
  links: SourceLinks;
  readOnly: boolean;
  pending: boolean;
  onToggleChecked: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const provenance = provenanceLabel(item);
  const differing = item.provenance?.notes ?? [];
  return (
    <li className="py-3" data-testid="requirement-row" data-pass-fail={item.isPassFail ? "true" : "false"} data-status={item.companyStatus}>
      <div className="flex gap-3">
        <span className="mt-0.5 w-9 shrink-0 font-mono text-xs text-muted-foreground">{item.ref}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm leading-5">
            {item.text}
            {item.threshold ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{item.threshold}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={item.isPassFail ? "danger" : item.kind === "minimum_score" ? "warning" : "neutral"} className={item.isPassFail ? "bg-background" : ""}>
              {REQUIREMENT_KIND_LABELS[item.kind] ?? item.kind}
            </Pill>
            <StatusPill status={item.companyStatus} />
            {item.citation ? (
              <CitationMark citation={item.citation} links={links} />
            ) : (
              <span className="text-xs text-muted-foreground">No source — added by hand</span>
            )}
            {provenance ? (
              <span title={provenance.hint} className="text-xs text-muted-foreground">
                {provenance.text}
              </span>
            ) : null}
          </div>
          {item.companyNote ? <p className="text-xs text-muted-foreground">{item.companyNote}</p> : null}
          {differing.map((note) => (
            <p key={note} className="text-xs text-warning">
              {note}
            </p>
          ))}
          {item.evidenceToProvide ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Evidence to provide:</span> {item.evidenceToProvide}
            </p>
          ) : null}
          {item.note ? (
            <p className="rounded border-l-2 border-primary/40 bg-muted/60 px-2 py-1 text-xs">
              <span className="font-medium">Your note:</span> {item.note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <label className={cn("flex items-center gap-1.5 text-xs", readOnly ? "text-muted-foreground" : "cursor-pointer")}>
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={item.checked}
              disabled={readOnly}
              onChange={(event) => onToggleChecked(event.target.checked)}
              aria-label={`Requirement ${item.ref} checked against the documents`}
            />
            Checked
          </label>
          {!readOnly ? (
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit requirement ${item.ref}`}>
                <Pencil aria-hidden className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onDelete} disabled={pending} aria-label={`Delete requirement ${item.ref}`}>
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function RequirementDialog({ editing, onClose, onSubmit }: { editing: NonNullable<Editing>; onClose: () => void; onSubmit: (values: Record<string, unknown>) => Promise<string | null> }) {
  const item = editing.mode === "edit" ? editing.item : null;
  const [text, setText] = useState(item?.text ?? "");
  const [category, setCategory] = useState<RequirementCategory>(item?.category ?? "other");
  const [kind, setKind] = useState<RequirementKind>(item?.kind ?? "mandatory");
  const [threshold, setThreshold] = useState(item?.threshold ?? "");
  const [status, setStatus] = useState<CompanyStatus>(item?.companyStatus ?? "unknown");
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit requirement ${item.ref}` : "Add a requirement"}</DialogTitle>
          <DialogDescription>
            {item?.citation ? "Your wording replaces the AI's. The source quote stays attached." : "Use this for anything the check missed. It will be marked as added by you."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError(null);
            const values: Record<string, unknown> = { text, category, kind, threshold: threshold || null, note: note || null };
            if (!item || status !== item.companyStatus) values.companyStatus = status;
            const message = await onSubmit(values);
            setSaving(false);
            if (message) setError(message);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="requirement-text">Requirement</Label>
            <Textarea id="requirement-text" value={text} onChange={(event) => setText(event.target.value)} rows={3} required minLength={3} maxLength={2000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="requirement-category">Category</Label>
              <NativeSelect id="requirement-category" className="w-full" value={category} onChange={(event) => setCategory(event.target.value as RequirementCategory)}>
                {REQUIREMENT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {REQUIREMENT_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirement-kind">Type</Label>
              <NativeSelect id="requirement-kind" className="w-full" value={kind} onChange={(event) => setKind(event.target.value as RequirementKind)}>
                {REQUIREMENT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {REQUIREMENT_KIND_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirement-threshold">Level (optional)</Label>
              <Input id="requirement-threshold" value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="e.g. £5,000,000" maxLength={300} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirement-status">Your position</Label>
              <NativeSelect id="requirement-status" className="w-full" value={status} onChange={(event) => setStatus(event.target.value as CompanyStatus)}>
                {COMPANY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === "met" ? "Met" : value === "gap" ? "Gap" : value === "verify" ? "Verify" : "Unknown"}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">A position you set by hand is not changed by later company checks.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requirement-note">Your note (optional)</Label>
            <Textarea id="requirement-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : item ? "Save changes" : "Add requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
