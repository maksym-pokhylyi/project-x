import type { ReactNode } from "react";

/**
 * Shell of the public data pages. Each page brings its own header and footer, as the
 * artboards draw them (features/procurement/components/public-chrome.tsx): the lean header
 * and "Where this comes from" on a supplier or tender page, the site header and the legal
 * line on Find and Claim. The column makes a short page's footer reach the bottom of the
 * screen.
 */
export default function DataLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-paper text-15 text-ink">{children}</div>;
}
