import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know the custom theme keys from src/app/globals.css, otherwise it
 * treats e.g. `text-13` as a colour and drops it when a real colour class follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["13", "15", "17", "22", "26", "30", "32", "34", "44"],
      font: ["display"],
      radius: ["chip", "control", "card", "modal", "inset"],
      shadow: ["raised", "overlay", "float"],
      container: ["content", "app", "reading"],
    },
  },
});

/** Merges Tailwind class names (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
