import { Body, Head, Hr, Html, Link, Preview, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { MARK, MARK_VIEWBOX } from "@/components/logo-paths";
import { identityText, site } from "@/config/site";

/*
 * The frame of every e-mail Bidfolio sends, drawn to the e-mail artboards
 * (docs/design/handoff/EmailConfirm-640 / -390, the same frame as Digest and
 * EmailCheckReady): a white sheet on paper-deep, 600 px wide at most (640 px with the
 * margin around it), the wordmark on a hairline, 16 px text on a 1.6 line, the action as a
 * semibold link with a green underline, then a hairline and two small paragraphs: why you
 * got this, and who sends it (the identity line of the site footer, from src/config/site.ts).
 *
 * E-mail clients decide a lot, so the frame is built to survive them:
 *   - tables and inline styles; the <style> block adds what capable clients can use and
 *     nothing depends on it;
 *   - no images at all: nothing is fetched when the message is opened (the privacy notice
 *     promises no tracking pixels). The mark is an inline SVG; clients that drop SVG show
 *     the wordmark alone;
 *   - phones: the text column is a 510 px block centred in the sheet, so it is 44 px from
 *     the edge at full width and 20 px on a narrow screen with no media query at all;
 *     where media queries work the sheet also runs edge to edge, as on the 390 artboard;
 *   - dark mode: clients that support it get the dark palette below; clients that invert
 *     colours on their own always find a text colour paired with a background colour;
 *   - every template also has a hand-written plain-text part (see text.ts): the action link
 *     is the first URL in it.
 *
 * Colours are the design tokens, written out because e-mail has no CSS variables
 * (tests/email-templates.test.ts checks them against src/app/globals.css).
 */
export const emailColors = {
  paperDeep: "#f2eee4",
  surface: "#ffffff",
  ink: "#161a1d",
  ink2: "#5a6165",
  line: "#e3ded2",
  brand: "#0f5a47",
  accent: "#b4690e",
  accentInk: "#925207",
} as const;

/** Dark palette for clients that honour prefers-color-scheme (Apple Mail, iOS Mail, Outlook for Mac). */
const dark = { ground: "#101315", sheet: "#1b2023", text: "#f2eee4", muted: "#b4b9bc", line: "#343b40", brand: "#7cc3ad", amber: "#e7b36a" } as const;

const sans = "Inter, Helvetica, Arial, sans-serif";
const serif = "'Source Serif 4', 'Iowan Old Style', Georgia, 'Times New Roman', serif";

const css = `
  body { margin: 0; }
  @media (max-width: 480px) {
    .bf-ground { padding: 20px 0 32px !important; }
    .bf-sheet { border-left: 0 !important; border-right: 0 !important; padding: 24px 20px 20px !important; }
    .bf-first { margin-top: 20px !important; }
    .bf-foot { margin-top: 24px !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .bf-ground { background-color: ${dark.ground} !important; }
    .bf-sheet { background-color: ${dark.sheet} !important; border-color: ${dark.line} !important; }
    .bf-rule { border-color: ${dark.line} !important; }
    .bf-ink, .bf-ink a, a.bf-ink { color: ${dark.text} !important; }
    .bf-muted, .bf-muted a { color: ${dark.muted} !important; }
    .bf-action { text-decoration-color: ${dark.brand} !important; }
    .bf-mark { fill: ${dark.brand} !important; }
    .bf-amber { color: ${dark.amber} !important; }
  }
`;

/* `text-wrap: pretty` keeps a last word from standing alone where the client knows it; elsewhere it is ignored. */
const text: CSSProperties = { fontFamily: sans, fontSize: 16, lineHeight: 1.6, color: emailColors.ink, margin: "10px 0 0", textWrap: "pretty" };

/**
 * Styles for the content of a message. `heading`, `paragraph`, `button` and `muted` are the
 * names older templates use; `button` is the action link of the artboards, not a filled
 * button.
 */
export const emailStyles = {
  /** A paragraph: 16 px on a 1.6 line, ink, 10 px after the one before. */
  paragraph: text,
  /** The greeting, first in the message: 24 px under the header rule. */
  greeting: { ...text, margin: "24px 0 0" },
  /** A paragraph that starts a new thought: 16 px above it. */
  spaced: { ...text, margin: "16px 0 0" },
  /** A section heading inside a longer message (digest, bid check): serif 24 px. */
  heading: { fontFamily: serif, fontSize: 24, lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.01em", color: emailColors.ink, margin: "36px 0 0" },
  /** The one action: a semibold link with a green underline, 44 px tall to the thumb. */
  button: {
    fontFamily: sans,
    display: "inline-block",
    padding: "10px 0",
    fontSize: 16,
    lineHeight: "24px",
    fontWeight: 600,
    color: emailColors.ink,
    textDecoration: "underline",
    textDecorationColor: emailColors.brand,
    textUnderlineOffset: 3,
  },
  /** A small muted line: how long a link works, where a figure comes from. */
  muted: { fontFamily: sans, fontSize: 14, lineHeight: 1.5, color: emailColors.ink2, margin: "2px 0 0" },
  /** An inline link in running text. */
  link: { color: emailColors.ink, textDecoration: "underline", textDecorationColor: emailColors.brand, textUnderlineOffset: 3 },
} satisfies Record<string, CSSProperties>;

/** A paragraph of the message. `first` is the greeting; `spaced` starts a new thought. */
export function EmailText({ children, first = false, spaced = false, style }: { children: ReactNode; first?: boolean; spaced?: boolean; style?: CSSProperties }) {
  return (
    <Text className={first ? "bf-ink bf-first" : "bf-ink"} style={{ ...(first ? emailStyles.greeting : spaced ? emailStyles.spaced : emailStyles.paragraph), ...style }}>
      {children}
    </Text>
  );
}

/** The one thing to do: a link on a line of its own, and under it how long it works. */
export function EmailAction({ href, children, note }: { href: string; children: ReactNode; note?: ReactNode }) {
  return (
    <>
      <Text style={{ fontSize: 16, lineHeight: "24px", margin: "6px 0 0" }}>
        <Link href={href} className="bf-ink bf-action" style={emailStyles.button}>
          {children}
        </Link>
      </Text>
      {note ? (
        <Text className="bf-muted" style={emailStyles.muted}>
          {note}
        </Text>
      ) : null}
    </>
  );
}

/** A section heading inside a longer message. */
export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text className="bf-ink" style={emailStyles.heading}>
      {children}
    </Text>
  );
}

/** A link in running text. */
export function EmailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="bf-ink bf-action" style={emailStyles.link}>
      {children}
    </Link>
  );
}

const table = { role: "presentation", width: "100%", cellPadding: 0, cellSpacing: 0, border: 0 } as const;
const hairline = `1px solid ${emailColors.line}`;

/**
 * The thing a message is about, between two hairlines: its title (17 px semibold) and the
 * lines under it (15 px), as the tender on the bid-check artboard.
 */
export function EmailSummary({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <table {...table} style={{ marginTop: 20 }}>
      <tbody>
        <tr>
          <td className="bf-rule" style={{ borderTop: hairline, borderBottom: hairline, padding: "16px 0" }}>
            <Text className="bf-ink" style={{ fontFamily: sans, fontSize: 17, lineHeight: 1.35, fontWeight: 600, color: emailColors.ink, margin: 0, textWrap: "pretty" }}>
              {title}
            </Text>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** A line under the title of an <EmailSummary>: the buyer, a place. */
export function EmailSummaryLine({ children }: { children: ReactNode }) {
  return (
    <Text className="bf-ink" style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.5, color: emailColors.ink, margin: "6px 0 0" }}>
      {children}
    </Text>
  );
}

/** A deadline, as everywhere in the product: an amber dot, then the date and the time left in amber ink, semibold. */
export function EmailDeadline({ children }: { children: ReactNode }) {
  return (
    <Text className="bf-amber" style={{ fontFamily: sans, fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: emailColors.accentInk, margin: "6px 0 0" }}>
      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", backgroundColor: emailColors.accent, marginRight: 8 }} />
      {children}
    </Text>
  );
}

/** Findings one under another, divided by hairlines (15 px): what a check found, what a plan includes. */
export function EmailList({ items }: { items: ReactNode[] }) {
  return (
    <table {...table} style={{ marginTop: 14 }}>
      <tbody>
        {items.map((item, index) => (
          <tr key={index}>
            <td className="bf-rule" style={{ borderTop: hairline, borderBottom: index === items.length - 1 ? hairline : undefined, padding: "10px 0" }}>
              <Text className="bf-ink" style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.5, color: emailColors.ink, margin: 0 }}>
                {item}
              </Text>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The frame. `preview` is the line mail clients show beside the subject; `reason` says in
 * one sentence why this person got the message ("You get this because …").
 */
export function EmailLayout({ preview, reason, children }: { preview: string; reason?: string; children: ReactNode }) {
  const rule = `1px solid ${emailColors.line}`;
  const hr: CSSProperties = { border: "none", borderTop: rule, width: "100%", margin: 0 };
  const small: CSSProperties = { fontFamily: sans, fontSize: 13, lineHeight: 1.6, color: emailColors.ink2, margin: 0 };
  return (
    <Html lang="en-GB">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{css}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailColors.paperDeep, fontFamily: sans, margin: 0, padding: 0 }}>
        <table {...table}>
          <tbody>
            <tr>
              <td className="bf-ground" style={{ backgroundColor: emailColors.paperDeep, padding: "28px 20px 48px" }}>
                <table {...table} align="center" style={{ maxWidth: 600, margin: "0 auto" }}>
                  <tbody>
                    <tr>
                      <td className="bf-sheet" style={{ backgroundColor: emailColors.surface, border: rule, padding: "36px 20px 28px" }}>
                        {/* 510 px = 600 − the edge − 44 px each side: the artboard's column at full width, 20 px from the edge on a phone. */}
                        <div style={{ maxWidth: 510, margin: "0 auto" }}>
                          <Text className="bf-ink" style={{ fontFamily: serif, fontSize: 22, lineHeight: "22px", fontWeight: 600, letterSpacing: "-0.015em", color: emailColors.ink, margin: "0 0 20px" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox={MARK_VIEWBOX} width="15" height="20" aria-hidden="true" style={{ marginRight: 7 }}>
                              <path className="bf-mark" d={MARK} fill={emailColors.brand} />
                            </svg>
                            {site.name}
                          </Text>
                          <Hr className="bf-rule" style={hr} />

                          {children}

                          <Hr className="bf-rule bf-foot" style={{ ...hr, marginTop: 28 }} />
                          {reason ? (
                            <Text className="bf-muted" style={{ ...small, marginTop: 20 }}>
                              {reason}
                            </Text>
                          ) : null}
                          <Text className="bf-muted" style={{ ...small, marginTop: reason ? 12 : 20 }}>
                            {identityText}
                          </Text>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
