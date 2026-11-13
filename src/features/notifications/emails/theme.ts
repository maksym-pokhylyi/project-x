import type { CSSProperties } from "react";

/**
 * Look of the scheduled e-mails, read from the designer's artboards
 * (docs/design/handoff/Digest-640.dc.html and Digest-390.dc.html).
 *
 * E-mail clients ignore most of CSS, so:
 *  - layout is tables, every style is inline;
 *  - the inline values are the DESKTOP ones (Outlook on Windows reads nothing else); the
 *    <style> block below adapts paddings to phones and colours to dark mode, for the
 *    clients that honour it (Apple Mail, Gmail, Outlook.com);
 *  - fonts are the system stacks: the brand faces are named first and used where installed,
 *    Georgia stands in for the display serif everywhere else.
 */
export const color = {
  canvas: "#F2EEE4",
  card: "#FFFFFF",
  ink: "#161A1D",
  ink2: "#5A6165",
  line: "#E3DED2",
  brand: "#0F5A47",
  amber: "#B4690E",
  amberInk: "#925207",
  amberTint: "#F7EBD7",
} as const;

export const font = {
  sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "'Source Serif 4', Georgia, 'Times New Roman', Times, serif",
  mono: "'IBM Plex Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

/** Width of the card: 600 px inside a 640 px canvas, as drawn. */
export const CARD_WIDTH = 600;

const text = (size: number, lineHeight: number | string, extra: CSSProperties = {}): CSSProperties => ({
  margin: 0,
  fontFamily: font.sans,
  fontSize: size,
  lineHeight,
  color: color.ink,
  ...extra,
});

export const styles = {
  body: { margin: 0, padding: 0, width: "100%", backgroundColor: color.canvas, WebkitTextSizeAdjust: "100%", textSizeAdjust: "100%" } as CSSProperties,
  canvas: { width: "100%", backgroundColor: color.canvas, borderCollapse: "collapse" } as CSSProperties,
  gutter: { padding: "28px 20px 48px" } as CSSProperties,
  card: { width: "100%", maxWidth: CARD_WIDTH, backgroundColor: color.card, border: `1px solid ${color.line}`, borderCollapse: "separate" } as CSSProperties,
  cardPad: { padding: "36px 44px 28px" } as CSSProperties,

  brandRow: { paddingBottom: 20, borderBottom: `1px solid ${color.line}` } as CSSProperties,
  wordmark: text(22, "22px", { fontFamily: font.serif, fontWeight: 600, letterSpacing: "-0.015em" }),

  paragraph: text(16, 1.6),
  heading: text(24, 1.2, { fontFamily: font.serif, fontWeight: 600, letterSpacing: "-0.01em" }),
  note: text(14, 1.5, { color: color.ink2 }),
  itemTitle: text(17, 1.35, { fontWeight: 600 }),
  itemMeta: text(15, 1.5),
  itemMuted: text(14, 1.5, { color: color.ink2 }),
  itemStrong: text(14, 1.5, { fontWeight: 600 }),
  deadline: text(14, 1.5, { fontWeight: 600, color: color.amberInk }),
  dot: { color: color.amber, fontSize: 11, lineHeight: "14px" } as CSSProperties,
  pill: { fontSize: 12, lineHeight: "18px", fontWeight: 600, backgroundColor: color.amberTint, color: color.amberInk, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" } as CSSProperties,

  link: { color: color.ink, textDecoration: "underline", textDecorationColor: color.brand, textUnderlineOffset: 3 } as CSSProperties,
  itemLink: { fontFamily: font.sans, fontSize: 15, lineHeight: 1.4, fontWeight: 500 } as CSSProperties,
  leadLink: { fontFamily: font.sans, fontSize: 16, lineHeight: 1.4, fontWeight: 600 } as CSSProperties,
  /** A link gets a 44 px row of its own: a comfortable target under a thumb. */
  linkCell: { height: 44, verticalAlign: "middle" } as CSSProperties,

  rule: { borderTop: `1px solid ${color.line}`, fontSize: 0, lineHeight: 0, height: 0 } as CSSProperties,
  footer: text(13, 1.6, { color: color.ink2 }),
  footerLink: { fontFamily: font.sans, fontSize: 13, lineHeight: 1.4 } as CSSProperties,
  placeholder: { fontFamily: font.mono, fontSize: 12 } as CSSProperties,
} as const;

/**
 * The only CSS outside style attributes. Phones (the 390 artboard): the card runs edge to
 * edge with 20 px padding. Dark mode: the same hierarchy on dark paper, for clients that
 * honour prefers-color-scheme; clients that recolour on their own (Gmail) start from
 * explicit foreground/background pairs on every element, so nothing becomes unreadable.
 */
export const headCss = `
  body { margin: 0; padding: 0; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; }
  .bf-mark-dark { display: none; }
  @media only screen and (max-width: 480px) {
    .bf-gutter { padding: 20px 0 32px !important; }
    .bf-card { border-left: 0 !important; border-right: 0 !important; }
    .bf-pad { padding: 24px 20px 20px !important; }
    .bf-h2 { margin-top: 32px !important; }
    .bf-first { margin-top: 20px !important; }
    .bf-closing { margin-top: 24px !important; }
    .bf-footer { margin-top: 16px !important; }
    .bf-footer-wide { margin-top: 24px !important; }
    .bf-list { margin-top: 12px !important; }
    /* A label and its value stack: the label small above, as on the 390 artboard. */
    .bf-fact-label { display: block !important; width: auto !important; padding: 10px 0 0 !important; font-size: 13px !important; }
    .bf-fact-value { display: block !important; padding: 2px 0 10px !important; border-top: 0 !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .bf-canvas { background-color: #131618 !important; }
    .bf-card { background-color: #1B1F22 !important; border-color: #33383C !important; }
    .bf-ink { color: #F2EEE4 !important; }
    .bf-ink2 { color: #B4BABF !important; }
    .bf-line { border-color: #33383C !important; }
    .bf-amber { color: #E8AE62 !important; }
    .bf-dot { color: #D98A2B !important; }
    .bf-pill { background-color: #3B2D14 !important; color: #F1C98E !important; }
    .bf-link { color: #F2EEE4 !important; text-decoration-color: #6FBF9F !important; }
    .bf-mark-light { display: none !important; }
    .bf-mark-dark { display: inline-block !important; }
  }
`;
