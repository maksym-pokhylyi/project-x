"use client";

import "./bid-theme.css";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateRequirementAction } from "@/features/bids/actions";
import { displayRef, gateGroup, type GateGroup } from "@/features/bids/view";
import { verificationState } from "@/features/bids/citation-state";
import { CitationMark, type SourceLinks } from "./citation";
import type { RequirementItem } from "./requirements-view";
import { StatusPill } from "./ui";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { FilterChip } from "@/components/ui/filter-chip";
import { ReferenceChip } from "@/components/ui/reference-chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * "Pass-or-fail requirements" on the brief: each line quoted from the pack with its source
 * chip, the status against the company's own facts with the reason, and ONE action.
 * Gaps come first, then what only the bidder can confirm, then what is met.
 */

type Filter = "all" | GateGroup;

const ORDER: Record<GateGroup, number> = { gap: 0, confirm: 1, met: 2 };
const MET_SHOWN = 3;

function ConfirmControl({ bidId, item, label }: { bidId: string; item: RequirementItem; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (companyStatus: "met" | "gap") =>
    startTransition(async () => {
      setError(null);
      const result = await updateRequirementAction(bidId, item.id, { companyStatus });
      if (!result.ok) setError(result.error.message);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant={label === "Confirm" ? "outline" : "link"} size={label === "Confirm" ? "sm" : undefined} type="button" className={label === "Confirm" ? undefined : "text-13"} data-testid="gate-confirm">
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(20rem,calc(100vw-1.5rem))]">
          <DropdownMenuLabel className="font-normal text-ink-2">Read the requirement on the page first. Your answer is recorded as set by you.</DropdownMenuLabel>
          <DropdownMenuItem disabled={pending} onSelect={() => set("met")} data-testid="gate-confirm-met">
            We meet this
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onSelect={() => set("gap")} data-testid="gate-confirm-gap">
            We do not meet this yet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function GateList({
  bidId,
  items,
  links,
  readOnly = false,
  libraryHref,
  factsConfirmed,
}: {
  bidId: string;
  /** Gating requirements only, in document order. */
  items: RequirementItem[];
  links: SourceLinks;
  readOnly?: boolean;
  /** Where "Upload evidence" goes; null hides the action (public sample). */
  libraryHref: string | null;
  factsConfirmed: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [showAllMet, setShowAllMet] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => ORDER[gateGroup(a.companyStatus)] - ORDER[gateGroup(b.companyStatus)]), [items]);
  const counts = useMemo(() => {
    const by: Record<GateGroup, number> = { gap: 0, confirm: 0, met: 0 };
    for (const item of items) by[gateGroup(item.companyStatus)] += 1;
    return by;
  }, [items]);

  const filtered = filter === "all" ? sorted : sorted.filter((item) => gateGroup(item.companyStatus) === filter);
  const collapseMet = filter === "all" && !showAllMet && counts.met > MET_SHOWN && counts.gap + counts.confirm > 0;
  const firstMet = new Set(
    filtered
      .filter((item) => gateGroup(item.companyStatus) === "met")
      .slice(0, MET_SHOWN)
      .map((item) => item.id),
  );
  const visible = collapseMet ? filtered.filter((item) => gateGroup(item.companyStatus) !== "met" || firstMet.has(item.id)) : filtered;
  const hidden = filtered.length - visible.length;

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "All", count: items.length },
    { key: "gap", label: "Gaps", count: counts.gap },
    { key: "confirm", label: "To confirm", count: counts.confirm },
    { key: "met", label: "Met", count: counts.met },
  ];

  return (
    <div className="rounded-card border border-line bg-surface" data-testid="gate-list">
      <div role="group" aria-label="Filter requirements" className="print:hidden flex flex-wrap gap-2 px-4 py-3 sm:px-6">
        {chips.map((chip) => (
          <FilterChip key={chip.key} pressed={filter === chip.key} count={chip.count} onClick={() => setFilter(chip.key)} data-testid={`gate-filter-${chip.key}`}>
            {chip.label}
          </FilterChip>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="border-t border-line px-4 py-6 text-sm text-ink-2 sm:px-6">{items.length === 0 ? "No pass-or-fail requirements were found in the pack. Read the instructions to tenderers yourself." : "None in this group."}</p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item) => {
            const group = gateGroup(item.companyStatus);
            const state = item.citation ? verificationState(item.citation) : "unverified";
            const quoted = Boolean(item.citation?.quote) && state !== "unverified";
            return (
              <li key={item.id} id={`req-${item.ref}`} data-testid="gate-row" data-group={group} className="border-t border-line flex scroll-mt-24 flex-wrap items-start gap-x-6 gap-y-3 px-4 py-[18px] sm:px-6">
                <span className="font-mono w-full shrink-0 pt-1 text-13 font-medium sm:w-14">{displayRef(item.ref)}</span>
                <div className="flex min-w-0 flex-[1_1_380px] flex-col items-start gap-2.5">
                  {quoted ? <p className="type-quote [overflow-wrap:anywhere]">“{item.citation!.quote}”</p> : <p className="text-15 leading-[1.5]">{item.text}</p>}
                  {quoted && item.threshold ? (
                    <p className="text-13 text-ink-2">
                      Level we read: <span className="font-semibold text-ink">{item.threshold}</span>
                    </p>
                  ) : !quoted ? (
                    <p className="text-13 text-danger">Our summary — this wording was not found in the pack text. Check the documents before relying on it.</p>
                  ) : null}
                  {item.citation ? <CitationMark citation={item.citation} links={links} /> : <ReferenceChip file="No source given" state="unverified" />}
                  {item.provenance?.notes?.length ? <p className="text-13 text-accent-ink">{item.provenance.notes[0]}</p> : null}
                </div>
                <div className="flex min-w-0 flex-[0_1_300px] flex-col items-start gap-1.5">
                  <StatusPill status={item.companyStatus} />
                  <p className="text-13 leading-[1.5]">
                    {item.companyNote ??
                      (item.statusByUser
                        ? group === "met"
                          ? "You confirmed that you meet this."
                          : "You marked this as not met yet."
                        : factsConfirmed
                          ? "Your company facts do not cover this."
                          : "Not compared with your company yet.")}
                  </p>
                  {item.statusByUser ? (
                    <span className="font-mono text-xs text-ink-2">Yours: set by you</span>
                  ) : group !== "confirm" && item.companyNote ? (
                    <span className="font-mono text-xs text-ink-2">Yours: company facts (confirmed)</span>
                  ) : null}
                  {readOnly ? null : group === "gap" && !item.statusByUser && libraryHref ? (
                    <ButtonLink variant="outline" size="sm" href={libraryHref} className="mt-0.5">
                      Upload evidence
                    </ButtonLink>
                  ) : group === "confirm" ? (
                    <ConfirmControl bidId={bidId} item={item} label="Confirm" />
                  ) : item.statusByUser ? (
                    <ConfirmControl bidId={bidId} item={item} label="Change" />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 ? (
        <div className="border-t border-line print:hidden px-4 py-1 sm:px-6">
          <Button variant="link" type="button" className="text-sm" onClick={() => setShowAllMet(true)} data-testid="gate-show-more">
            Show {hidden} more met requirement{hidden === 1 ? "" : "s"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
