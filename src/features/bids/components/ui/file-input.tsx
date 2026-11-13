import type { ComponentProps, Ref } from "react";

/**
 * The one raw file input of the bid desk and library. A file input has no visible form of
 * its own: it is always hidden and opened by a Button or a drop zone, so the library has no
 * styled version of it. Every upload goes through this component.
 */
export function FileInput({ ref, ...props }: Omit<ComponentProps<"input">, "type"> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} type="file" {...props} />;
}
