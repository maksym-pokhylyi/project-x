"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { setTenderStateAction } from "../actions";
import { bidCheckHref } from "../domain/links";
import { MatchRow, tenderListClasses, tenderListItemClasses, type MatchRowItem } from "./match-row";
import { SaveToggle } from "@/components/ui/save-toggle";

/**
 * The rows of the Matches and Early signals tabs, with their actions:
 *
 *   Start a bid check   a link to the bid desk with the tender filled in
 *   Save / Saved        a toggle, optimistic: it turns at once and settles on the server's answer
 *   Dismiss             takes the row off the radar; its place says so and offers Undo until
 *                       the page is left, so a slip of the finger costs nothing
 *
 * `saved` is the real state from the server (ocids of the workspace's saved tenders).
 * Keyboard: after Dismiss, focus moves to Undo; after Undo, back to the row's title.
 */
/** `wasSaved` is noted when the row is dismissed: by the time Undo is pressed the server no longer lists it as saved. */
type Dismissed = { item: MatchRowItem; index: number; wasSaved: boolean };

export function RadarList({
  items,
  saved,
  now,
  firstRank,
  signal = false,
  showWider = false,
  label,
}: {
  items: MatchRowItem[];
  saved: string[];
  /** ISO instant the page was rendered at, so server and browser agree on "14 days left". */
  now: string;
  /** Rank of the first row; rows are not numbered when it is undefined. */
  firstRank?: number;
  signal?: boolean;
  showWider?: boolean;
  label: string;
}) {
  const [savedNow, setSaved] = useOptimistic(new Set(saved), (current, change: { ocid: string; saved: boolean }) => {
    const next = new Set(current);
    if (change.saved) next.add(change.ocid);
    else next.delete(change.ocid);
    return next;
  });
  const [dismissed, setDismissed] = useState<Dismissed[]>([]);
  const [, startTransition] = useTransition();
  const focusTarget = useRef<{ ocid: string; what: "undo" | "title" } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const at = new Date(now);

  // Rows the server still sends are shown as rows — unless they were just dismissed here.
  const gone = new Set(dismissed.map((entry) => entry.item.ocid));
  const rows: Array<{ kind: "row"; item: MatchRowItem } | { kind: "dismissed"; item: MatchRowItem }> = items.filter((item) => !gone.has(item.ocid)).map((item) => ({ kind: "row", item }));
  for (const entry of [...dismissed].sort((a, b) => a.index - b.index)) rows.splice(Math.min(entry.index, rows.length), 0, { kind: "dismissed", item: entry.item });

  useEffect(() => {
    const target = focusTarget.current;
    if (!target || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-row="${CSS.escape(target.ocid)}"]`);
    const element = row?.querySelector<HTMLElement>(target.what === "undo" ? "[data-undo]" : "h3 a");
    if (element) {
      element.focus();
      focusTarget.current = null;
    }
  });

  function toggleSaved(item: MatchRowItem) {
    const next = !savedNow.has(item.ocid);
    startTransition(async () => {
      setSaved({ ocid: item.ocid, saved: next });
      const result = await setTenderStateAction({ ocid: item.ocid, state: next ? "saved" : null });
      if (!result.ok) toast.error(result.error.message);
    });
  }

  function dismiss(item: MatchRowItem, index: number) {
    setDismissed((current) => [...current.filter((entry) => entry.item.ocid !== item.ocid), { item, index, wasSaved: savedNow.has(item.ocid) }]);
    focusTarget.current = { ocid: item.ocid, what: "undo" };
    startTransition(async () => {
      const result = await setTenderStateAction({ ocid: item.ocid, state: "dismissed" });
      if (!result.ok) {
        setDismissed((current) => current.filter((entry) => entry.item.ocid !== item.ocid));
        toast.error(result.error.message);
      }
    });
  }

  function undo(item: MatchRowItem) {
    focusTarget.current = { ocid: item.ocid, what: "title" };
    const wasSaved = dismissed.find((entry) => entry.item.ocid === item.ocid)?.wasSaved ?? false;
    startTransition(async () => {
      // A tender that was saved before it was dismissed comes back saved.
      const result = await setTenderStateAction({ ocid: item.ocid, state: wasSaved ? "saved" : null });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDismissed((current) => current.filter((entry) => entry.item.ocid !== item.ocid));
    });
  }

  let rank = firstRank;
  return (
    <ol ref={listRef} aria-label={label} className={tenderListClasses} data-testid="radar-list">
      {rows.map((row, index) => {
        if (row.kind === "dismissed") {
          return (
            <li key={row.item.ocid} data-row={row.item.ocid} className={tenderListItemClasses} data-testid="dismissed-row">
              <p role="status" className="flex flex-wrap items-center gap-x-3 px-4 py-2 text-sm text-ink-2 md:px-6">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  Dismissed: <span className="text-ink">{row.item.title}</span>. It will not be shown on your radar again.
                </span>
                <Button type="button" variant="link" data-undo className="hit-40 text-sm" onClick={() => undo(row.item)}>
                  Undo<span className="sr-only">: put {row.item.title} back</span>
                </Button>
              </p>
            </li>
          );
        }
        const item = row.item;
        const isSaved = savedNow.has(item.ocid);
        const rowRank = rank === undefined ? undefined : rank++;
        return (
          <li key={item.ocid} data-row={item.ocid} className={tenderListItemClasses}>
            <MatchRow
              item={item}
              now={at}
              rank={rowRank}
              href={`/app/tenders/${item.ocid}`}
              signal={signal}
              showWider={showWider}
              actions={
                signal ? (
                  <SaveToggle pressed={isSaved} onClick={() => toggleSaved(item)} itemLabel={item.title} className="text-15 @max-2xl:flex-1 @2xl:self-end @2xl:text-sm" data-testid="save-toggle" />
                ) : (
                  <>
                    {/* In a phone card the main button takes what Save and Dismiss leave (it may be as narrow as its words on a 360 px screen). */}
                    <ButtonLink variant="outline" href={bidCheckHref(item.ocid)} className="min-w-0 flex-1 basis-0 px-1 text-15 @max-[21rem]:text-sm @2xl:flex-none @2xl:basis-auto @2xl:px-[1.125rem] @2xl:text-sm">
                      Start a bid check
                    </ButtonLink>
                    <div className="contents @2xl:flex @2xl:items-center @2xl:gap-1">
                      <SaveToggle pressed={isSaved} onClick={() => toggleSaved(item)} itemLabel={item.title} className="px-2.5 @2xl:flex-1" data-testid="save-toggle" />
                      <Button type="button" variant="ghost" className="px-1 text-sm font-medium text-ink-2 hover:text-ink @2xl:px-2" onClick={() => dismiss(item, index)} data-testid="dismiss">
                        Dismiss<span className="sr-only">: {item.title}</span>
                      </Button>
                    </div>
                  </>
                )
              }
            />
          </li>
        );
      })}
    </ol>
  );
}
