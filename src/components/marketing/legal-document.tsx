import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { site } from "@/config/site";
import { Placeholders } from "./placeholders";

/**
 * A block of a legal section:
 *   string                      a paragraph
 *   string[]                    a bullet list
 *   { subheading }              a sub-heading inside the section
 *   { note }                    a highlighted note
 *   { table: { head, rows } }   a small table (e.g. retention periods)
 *
 * Text supports two inline marks: [label](/path-or-url) for links and [[PLACEHOLDER]] for
 * seller-specific details that have not been confirmed yet (rendered highlighted).
 */
export type LegalBlock =
  | string
  | string[]
  | { subheading: string }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } };

export type LegalSection = {
  heading: string;
  /** Anchor id; derived from the heading when omitted. */
  id?: string;
  body: LegalBlock[];
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const sectionId = (section: LegalSection) => section.id ?? slug(section.heading);

/**
 * True while a document still carries a [[MARKER]]: wording that the lawyer or the founder
 * has to settle. The "Draft for review" notice shows on exactly those documents.
 */
export function hasOpenMarkers(...content: unknown[]): boolean {
  return JSON.stringify(content).includes("[[");
}

const LINK = /\[([^\]\[]+)\]\(([^)\s]+)\)/g;

/** Renders the inline marks of a legal string: links and placeholders. */
export function LegalText({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) parts.push(<Placeholders key={`t${index}`} text={text.slice(last, index)} />);
    parts.push(
      href!.startsWith("/") ? (
        <Link key={`l${index}`} href={href!}>
          {label}
        </Link>
      ) : (
        <a key={`l${index}`} href={href} rel="noopener">
          {label}
        </a>
      ),
    );
    last = index + whole.length;
  }
  if (last < text.length) parts.push(<Placeholders key="tail" text={text.slice(last)} />);
  return <>{parts}</>;
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p>
        <LegalText text={block} />
      </p>
    );
  }
  if (Array.isArray(block)) {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-ink-2">
        {block.map((item) => (
          <li key={item} className="pl-1">
            <LegalText text={item} />
          </li>
        ))}
      </ul>
    );
  }
  if ("subheading" in block) {
    return <h3 className="pt-3 font-sans text-17 font-semibold text-ink">{block.subheading}</h3>;
  }
  if ("note" in block) {
    return (
      <p role="note" className="rounded-control bg-info-tint px-4 py-3.5 text-15 text-ink">
        <LegalText text={block.note} />
      </p>
    );
  }
  return (
    // A table wider than a phone scrolls sideways inside its frame: the frame is a named region
    // and a Tab stop, so the keyboard can scroll it too (WCAG 2.1.1).
    <div role="region" aria-label={`Table: ${block.table.head.join(", ")}`} tabIndex={0} className="overflow-x-auto rounded-card border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <table className="w-full min-w-[30rem] border-separate border-spacing-0 bg-surface text-left text-sm leading-5">
        <thead>
          <tr>
            {block.table.head.map((cell) => (
              <th key={cell} scope="col" className="border-b border-line px-4 py-3 text-xs leading-[1.125rem] font-semibold text-ink-2 first:pl-5 last:pr-5">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child>*]:border-b-0">
          {block.table.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="border-b border-line px-4 py-3.5 pl-5 align-top font-semibold text-ink">
                    <LegalText text={cell} />
                  </th>
                ) : (
                  <td key={index} className="border-b border-line px-4 py-3.5 align-top text-ink last:pr-5">
                    <LegalText text={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Shared renderer for the long-form pages under /legal, in the language of the artboards
 * (a mono meta line above a serif title, hairline cards): a reading column of 68 characters,
 * numbered sections with stable anchors, and a table of contents that is sticky beside the
 * text on desktop and a disclosure above it on phones. Prints as a clean document.
 *
 * The documents are written for this product and marked for review; they are not legal advice.
 * Everything a lawyer or the founder must confirm is listed in docs/legal/TODO.md.
 */
export function LegalDocument({
  title,
  intro,
  summary,
  sections,
  children,
}: {
  title: string;
  intro: string;
  /** Optional "at a glance" points shown before the sections. */
  summary?: string[];
  sections: LegalSection[];
  children?: ReactNode;
}) {
  const toc = (
    <ol className="space-y-0.5 text-sm">
      {sections.map((section, index) => (
        <li key={sectionId(section)}>
          <a href={`#${sectionId(section)}`} className="link-quiet grid min-h-8 grid-cols-[1.75rem_1fr] items-baseline rounded-sm py-1.5">
            <span className="font-mono text-xs text-ink-2">{String(index + 1).padStart(2, "0")}</span>
            <span>{section.heading}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="container-content pt-10 pb-14 md:pt-16 md:pb-24">
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside data-print="hide" className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
            <p className="mb-2 text-sm font-semibold text-ink">On this page</p>
            {toc}
          </nav>
        </aside>

        <article data-print="urls" className="max-w-reading min-w-0">
          <header>
            <p className="type-ref text-ink-2">
              Legal · last updated <time dateTime={site.legal.lastUpdated}>{formatDate(site.legal.lastUpdated)}</time>
            </p>
            <h1 className="type-h1 mt-3 text-ink">{title}</h1>
          </header>

          {hasOpenMarkers(intro, summary, sections) ? (
            <p role="note" className="mt-6 flex items-start gap-3 rounded-control bg-accent-tint px-4 py-3.5 text-sm text-ink">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong className="font-semibold">Draft for review.</strong> Details marked like <Placeholders text="[[THIS]]" /> have not been confirmed yet. This
                document has not been reviewed by a lawyer and is not legal advice.
              </span>
            </p>
          ) : null}

          <p className="type-lead mt-6 text-ink">
            <LegalText text={intro} />
          </p>

          {summary ? (
            <section aria-labelledby="at-a-glance" className="mt-8 rounded-card border border-line bg-surface p-5">
              <h2 id="at-a-glance" className="font-display text-xl font-semibold text-ink">
                At a glance
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-15 text-ink marker:text-ink-2">
                {summary.map((item) => (
                  <li key={item} className="pl-1">
                    <LegalText text={item} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <details data-print="hide" className="group mt-8 rounded-card border border-line bg-surface lg:hidden">
            <summary className="flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-ink">
              On this page
              <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-none stroke-current stroke-[1.8] transition-transform [stroke-linecap:round] [stroke-linejoin:round] group-open:rotate-180">
                <path d="M3.5 6l4.5 4.5L12.5 6" />
              </svg>
            </summary>
            <nav aria-label="On this page" className="border-t border-line px-4 py-3">
              {toc}
            </nav>
          </details>

          <div className="mt-10 space-y-12">
            {sections.map((section, index) => (
              <section key={sectionId(section)} id={sectionId(section)} aria-labelledby={`${sectionId(section)}-title`} className="scroll-mt-24">
                <h2 id={`${sectionId(section)}-title`} className="type-h3 text-ink">
                  <span className="mr-2 text-ink-2">{index + 1}.</span>
                  {section.heading}
                </h2>
                <div className="type-reading mt-4 space-y-4 text-ink">
                  {section.body.map((block, blockIndex) => (
                    <Fragment key={blockIndex}>
                      <Block block={block} />
                    </Fragment>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {children}

          <footer className="mt-12 border-t border-line pt-6 text-sm text-ink-2">
            <p>
              Questions about this document? Write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
