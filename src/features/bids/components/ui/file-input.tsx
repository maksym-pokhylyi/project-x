import type { ComponentProps, Ref } from "react";

/**
 * The one raw file input of the bid desk and library. A file input has no visible form of
 * its own: it is always hidden and opened by a Button or a drop zone, so the library has no
 * styled version of it. Every upload goes through this component.
 *
 * `aria-label` is required: the input is still reachable with assistive technology, and a
 * form control without a name fails WCAG 4.1.2. Say what is uploaded ("Tender pack files").
 */
export function FileInput({ ref, ...props }: Omit<ComponentProps<"input">, "type" | "aria-label"> & { ref?: Ref<HTMLInputElement>; "aria-label": string }) {
  return <input ref={ref} type="file" {...props} />;
}
