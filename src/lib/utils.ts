import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to know the custom theme keys from src/app/globals.css, otherwise it
 * treats e.g. `text-13` as a colour and drops it when a real colour class follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["13"],
      font: ["display"],
      radius: ["control", "card", "modal"],
      shadow: ["raised", "overlay"],
      container: ["content", "reading"],
      tracking: ["eyebrow"],
    },
  },
});

/** Merges Tailwind class names (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
