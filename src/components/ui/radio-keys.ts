import type { KeyboardEvent } from "react";

/**
 * Arrow-key behaviour for a hand-built radio group (segmented controls made of
 * `<button role="radio" data-value="…">` inside an element with role="radiogroup").
 *
 * Use together with a roving tab index: the checked radio has tabIndex 0, the others -1.
 * Left/Up selects the previous option, Right/Down the next, wrapping at the ends; focus follows
 * the selection, as in a native radio group.
 */
export function radioGroupKeyDown<T extends string>(event: KeyboardEvent<HTMLElement>, values: readonly T[], current: T, select: (value: T) => void): void {
  const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
  if (delta === 0) return;
  event.preventDefault();
  const next = values[(values.indexOf(current) + delta + values.length) % values.length];
  if (next === undefined) return;
  select(next);
  const group = event.currentTarget.closest('[role="radiogroup"]');
  requestAnimationFrame(() => group?.querySelector<HTMLElement>(`[role="radio"][data-value="${next}"]`)?.focus());
}
