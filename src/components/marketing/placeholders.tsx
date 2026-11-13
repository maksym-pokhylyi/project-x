import { Fragment } from "react";

const PATTERN = /(\[\[[^\]]+\]\])/g;

/**
 * Renders text that may contain [[PLACEHOLDER]] markers, highlighting each one so that a
 * seller-specific detail which has not been filled in can never pass for real content.
 */
export function Placeholders({ text }: { text: string }) {
  if (!text.includes("[[")) return <>{text}</>;
  return (
    <>
      {text.split(PATTERN).map((part, index) =>
        part.startsWith("[[") ? (
          <mark key={index} className="rounded-xs bg-accent-tint box-decoration-clone px-1 font-mono text-[0.875em] [overflow-wrap:anywhere] text-accent-ink" title="To be confirmed before launch">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** True when the text still contains a [[PLACEHOLDER]]. */
export function hasPlaceholder(text: string): boolean {
  return text.includes("[[");
}
