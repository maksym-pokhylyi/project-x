/*
 * Control heights (Foundations artboard, block "Control sizes"): ONE scale for fields and
 * buttons, and never two heights in one row.
 *
 *   bar     44 px   toolbars, tables, filters, row actions
 *   form    48 px   forms — 52 px on phones, where a form is worked with a thumb
 *   search  52 px   search rows: the field and its button
 *
 * A button beside a field has the field's height; a form's submit button takes its fields'
 * height. Until <Button> and <Input> grow shared `size` tokens (sm 44 / md 48 / lg 52), a
 * component names its height ONCE with one of these and puts it on every control of the row
 * or form — so the later switch to the shared sizes is a one-line change per component.
 *
 * Candidate for src/components/ui (no dependencies).
 */
export const controlSize = {
  bar: "h-11",
  form: "h-[3.25rem] md:h-12",
  search: "h-[3.25rem]",
} as const;

export type ControlSize = keyof typeof controlSize;
