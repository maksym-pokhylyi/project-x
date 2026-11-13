"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { FieldError, FormError } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { countRadarMatchesAction, saveRadarChoicesAction, saveRadarProfileAction, type ProfileFormState } from "../actions";
import { pluralise } from "../domain/format";
import type { RadarEditData } from "../radar/view";
import { ChoiceGroup, TickRow } from "./ui/choice";
import { controlSize } from "./ui/control-size";
import { SideSheet } from "./ui/side-sheet";

/**
 * "Trades and regions": what a radar matches on, as the RadarEdit artboards draw it — a
 * right-hand panel over the radar on a desk, a page of its own on a phone (and for anyone
 * without script: the trigger is a real link to that page).
 *
 * Trades read from the company's contract wins are ticked and say so; unticking one switches
 * it off for this workspace only. The short list adds trades by name; "More trades" finds
 * any other by its official name. Regions are the twelve UK regions.
 *
 * The line above Save counts the open tenders the ticks would match — asked from the
 * server after each change, without saving anything.
 */
const INITIAL: ProfileFormState = { error: null };
const SETUP_PATH = "/app/radar/setup";

function editHref(source: string): string {
  return `${SETUP_PATH}?source=${encodeURIComponent(source)}`;
}

type TradeOption = { code: string; label: string };

/** "More trades": find a trade by its official name and tick it. Already chosen ones stay listed. */
function MoreTrades({ initial, height }: { initial: TradeOption[]; height: string }) {
  const id = useId();
  const [chosen, setChosen] = useState<TradeOption[]>(initial);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<TradeOption[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/procurement/cpv?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { results?: TradeOption[] };
        setResults(body.results ?? []);
        setStatus("idle");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const chosenCodes = new Set(chosen.map((option) => option.code));
  const offered = term.trim().length >= 2 ? results.filter((option) => !chosenCodes.has(option.code)).slice(0, 8) : [];

  return (
    <div className="flex flex-col gap-1 pt-2">
      {chosen.map((option) => (
        <TickRow
          key={option.code}
          name="cpv"
          value={option.code}
          defaultChecked
          onCheckedChange={(checked) => {
            if (checked !== true) setChosen((current) => current.filter((entry) => entry.code !== option.code));
          }}
        >
          {option.label}
        </TickRow>
      ))}
      <div className="flex flex-col gap-2 pt-1">
        <Label htmlFor={id}>More trades</Label>
        <Input id={id} type="search" value={term} onChange={(event) => setTerm(event.currentTarget.value)} placeholder="For example, scaffolding" autoComplete="off" className={height} aria-describedby={`${id}-status`} />
        <p id={`${id}-status`} role="status" className="text-13 text-ink-2">
          {status === "loading" ? "Searching…" : status === "error" ? "The search did not work. Try again in a moment." : term.trim().length >= 2 && offered.length === 0 ? "No trade by that name." : "Trades are filed under the names buyers use on Find a Tender."}
        </p>
        {offered.length > 0 ? (
          <ul aria-label="Trades found" className="flex flex-col">
            {offered.map((option) => (
              <li key={option.code}>
                <TickRow
                  checked={false}
                  onCheckedChange={() => {
                    setChosen((current) => [...current, option]);
                    setTerm("");
                    setResults([]);
                  }}
                >
                  {option.label}
                </TickRow>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Fields({ data, error, height }: { data: RadarEditData; error: ProfileFormState["error"]; height: string }) {
  const fieldErrors = (error?.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-6">
      <input type="hidden" name="source" value={data.source} />
      {error && Object.keys(fieldErrors).length === 0 ? <FormError message={error.message} /> : null}
      <ChoiceGroup legend="Trades" hint="tick all that apply" error={fieldErrors.cpvCodes?.[0]} data-testid="edit-trades">
        {data.own.map((trade) => (
          <span key={trade.code} className="contents">
            <input type="hidden" name="ownAll" value={trade.code} />
            <TickRow name="own" value={trade.code} defaultChecked={trade.checked} trailing="From your contract wins">
              {trade.label}
            </TickRow>
          </span>
        ))}
        {data.trades.map((trade) => (
          <TickRow key={trade.key} name="trade" value={trade.key} defaultChecked={trade.checked}>
            {trade.label}
          </TickRow>
        ))}
        <MoreTrades initial={data.other} height={height} />
      </ChoiceGroup>
      <ChoiceGroup legend="Regions" hint="tick all that apply" columns="two" data-testid="edit-regions">
        {data.regions.map((region) => (
          <TickRow key={region.code} name="region" value={region.code} defaultChecked={region.checked}>
            {region.label}
          </TickRow>
        ))}
      </ChoiceGroup>
      <p className="-mt-3 text-13 text-ink-2">With no region ticked, the radar looks at the whole of the UK.</p>
      {fieldErrors.name?.[0] ? <FieldError>{fieldErrors.name[0]}</FieldError> : null}
    </div>
  );
}

type Count = { value: number; fresh: boolean };

/** The count above Save: asked from the server a moment after each change, without saving anything. */
function useLiveCount(initial: number) {
  const [count, setCount] = useState<Count>({ value: initial, fresh: true });
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | null>(null);
  const request = useRef(0);

  function recount() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setCount((current) => ({ ...current, fresh: false }));
    timer.current = window.setTimeout(async () => {
      if (!formRef.current) return;
      const mine = ++request.current;
      const result = await countRadarMatchesAction(new FormData(formRef.current));
      // Only the answer to the latest question counts.
      if (mine !== request.current) return;
      if (result.ok) setCount({ value: result.data.count, fresh: true });
      else setCount((current) => ({ ...current, fresh: true }));
    }, 350);
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { count, formRef, recount };
}

function CountLine({ count }: { count: Count }) {
  return (
    <p aria-live="polite" className={cn("text-15 font-semibold text-ink transition-opacity", !count.fresh && "opacity-60")} data-testid="edit-count">
      {count.value === 0 ? "No open tenders match these choices right now" : `${pluralise(count.value, "open tender")} ${count.value === 1 ? "matches" : "match"} these choices`}
    </p>
  );
}

/** The form as a page of its own (phones, and anyone without script: it posts and redirects). */
export function RadarEditPage({ data, cancelHref }: { data: RadarEditData; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(saveRadarProfileAction, INITIAL);
  const { count, formRef, recount } = useLiveCount(data.count);
  const height = controlSize.form;
  return (
    <form ref={formRef} action={formAction} onChange={recount} className="flex flex-col gap-6" data-testid="radar-edit-form">
      <Fields data={data} error={state.error} height={height} />
      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <CountLine count={count} />
        <div className="flex flex-col gap-2 md:flex-row">
          <Button type="submit" loading={pending} className={cn(height, "md:min-w-28")} data-testid="radar-edit-save">
            Save
          </Button>
          <ButtonLink variant="outline" href={cancelHref} className={cn(height, "md:min-w-28")}>
            Cancel
          </ButtonLink>
        </div>
      </div>
    </form>
  );
}

/**
 * "Edit": opens the panel on a desk; on a phone — or without script — it is a plain link
 * to the page form. `children` is the label; `variant` its look (a link beside the chips,
 * an outline button in the first-run guide).
 */
export function RadarEditTrigger({ data, variant = "link", children, className }: { data: RadarEditData; variant?: "link" | "outline" | "default"; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  return (
    <>
      <ButtonLink
        ref={trigger}
        variant={variant}
        href={editHref(data.source)}
        className={cn(variant === "link" ? "hit-40 text-sm" : null, className)}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || !window.matchMedia("(min-width: 48rem)").matches) return;
          event.preventDefault();
          setOpen(true);
        }}
        data-testid="radar-edit-open"
      >
        {children}
      </ButtonLink>
      {/* Keyed by what is saved: after a save the panel starts again from the new choices, while the trigger (and focus on it) stays. */}
      <EditSheet key={savedChoices(data)} data={data} open={open} onOpenChange={setOpen} returnFocusTo={trigger} />
    </>
  );
}

/** What the server holds for this radar, as one string: the panel's own state is thrown away when it changes. */
function savedChoices(data: RadarEditData): string {
  return [
    data.source,
    data.count,
    data.own.filter((trade) => trade.checked).map((trade) => trade.code).join(","),
    data.trades.filter((trade) => trade.checked).map((trade) => trade.key).join(","),
    data.other.map((trade) => trade.code).join(","),
    data.regions.filter((region) => region.checked).map((region) => region.code).join(","),
  ].join("|");
}

function EditSheet({ data, open, onOpenChange, returnFocusTo }: { data: RadarEditData; open: boolean; onOpenChange: (open: boolean) => void; returnFocusTo: RefObject<HTMLElement | null> }) {
  const [error, setError] = useState<ProfileFormState["error"]>(null);
  const [pending, setPending] = useState(false);
  const formId = useId();
  const { count, formRef, recount } = useLiveCount(data.count);

  async function save(formData: FormData) {
    setPending(true);
    const result = await saveRadarChoicesAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // The radar underneath has been refreshed with the new choices.
    setError(null);
    onOpenChange(false);
  }

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      returnFocusTo={returnFocusTo}
      title="Trades and regions"
      description="Your radar shows open tenders that match any of your trades in any of your regions."
      footer={
        <div className="flex flex-col gap-3">
          <CountLine count={count} />
          <div className="flex gap-2">
            <Button type="submit" form={formId} loading={pending} className={cn(controlSize.form, "min-w-28")} data-testid="radar-edit-save">
              Save
            </Button>
            <Button type="button" variant="outline" className={cn(controlSize.form, "min-w-28")} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      }
    >
      <form id={formId} ref={formRef} action={save} onChange={recount} data-testid="radar-edit-form">
        <Fields data={data} error={error} height={controlSize.form} />
      </form>
    </SideSheet>
  );
}
