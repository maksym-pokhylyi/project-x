import { Body, Head, Html, Img, Preview } from "@react-email/components";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { site } from "@/config/site";
import { CARD_WIDTH, color, headCss, styles } from "./theme";

/**
 * Building blocks of the scheduled e-mails: the frame of the artboards (canvas, card, the
 * Bidfolio lockup, footer) and the few pieces the letters are made of. Local to this module
 * on purpose — the shared transactional frame (src/emails/layout.tsx) is being restyled
 * separately; these can be folded into it afterwards.
 *
 * Tables for layout, inline styles, no scripts, and no image that tells us the message was
 * opened: the only pictures are the two static files of the mark (public/email/).
 */

const presentation = { role: "presentation", cellPadding: 0, cellSpacing: 0, border: 0 } as const;

export type EmailLink = { label: string; url: string };

export type FooterModel = {
  /** Why the reader gets this e-mail, in one sentence. */
  reason: string;
  /** The human line: replies reach a person. */
  signOff: string;
  /**
   * Links under the reason, as each artboard draws them: the digest has "Unsubscribe" and
   * "Change what you get", the deadline reminder only the second, the renewal notice none.
   */
  links: EmailLink[];
  /** Who operates the service, the licence of the data, independence from government. */
  identity: IdentityPart[];
};

/** A run of the identity line; `placeholder` marks a detail that has not been filled in yet. */
export type IdentityPart = { text: string; placeholder?: boolean };

export type FrameProps = {
  /** Shown by mail clients next to the subject. */
  preview: string;
  /** Absolute URLs of the mark on light and on dark paper. */
  markUrl: string;
  markDarkUrl: string;
  footer: FooterModel;
  /** Space above the footer: 20 px in the digest and the renewal notice, 28 px in the deadline reminder. */
  footerTop?: number;
  children: ReactNode;
};

export function EmailFrame({ preview, markUrl, markDarkUrl, footer, footerTop = 20, children }: FrameProps) {
  return (
    <Html lang="en-GB">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: headCss }} />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <table {...presentation} width="100%" className="bf-canvas" style={styles.canvas}>
          <tbody>
            <tr>
              <td align="center" className="bf-gutter" style={styles.gutter}>
                {/* width attribute for Outlook, max-width for everyone else */}
                <table {...presentation} width={CARD_WIDTH} className="bf-card bf-line" style={styles.card}>
                  <tbody>
                    <tr>
                      <td className="bf-pad" style={styles.cardPad}>
                        <Lockup markUrl={markUrl} markDarkUrl={markDarkUrl} />
                        {children}
                        <Footer {...footer} top={footerTop} />
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

/** The mark and the wordmark on one baseline, with the hairline under them. */
function Lockup({ markUrl, markDarkUrl }: { markUrl: string; markDarkUrl: string }) {
  const mark: CSSProperties = { display: "inline-block", verticalAlign: "baseline", width: 15, height: 20 };
  return (
    <table {...presentation} width="100%">
      <tbody>
        <tr>
          <td className="bf-line" style={styles.brandRow}>
            <Img src={markUrl} width={15} height={20} alt="" className="bf-mark-light" style={mark} />
            <Img src={markDarkUrl} width={15} height={20} alt="" className="bf-mark-dark" style={{ ...mark, display: "none" }} />
            <span className="bf-ink" style={{ ...styles.wordmark, paddingLeft: 7 }}>
              {site.name}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function Paragraph({ children, top = 10, className, style }: { children: ReactNode; top?: number; className?: string; style?: CSSProperties }) {
  return (
    <p className={["bf-ink", className].filter(Boolean).join(" ")} style={{ ...styles.paragraph, marginTop: top, ...style }}>
      {children}
    </p>
  );
}

/** The one sentence a reminder or a notice exists for, in semibold under the greeting. */
export function Headline({ children }: { children: ReactNode }) {
  return <Paragraph style={{ fontWeight: 600 }}>{children}</Paragraph>;
}

/** A section: serif heading, one muted line under it, then the list. */
export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <h2 className="bf-ink bf-h2" style={{ ...styles.heading, marginTop: 36 }}>
        {title}
      </h2>
      {note ? (
        <p className="bf-ink2" style={{ ...styles.note, marginTop: 4 }}>
          {note}
        </p>
      ) : null}
    </>
  );
}

/** Rows (ItemRow, FactRow) separated by hairlines, closed by one more hairline. */
export function ItemList({ children, top = 14, columns = 1 }: { children: ReactNode; top?: number; columns?: number }) {
  return (
    <table {...presentation} width="100%" className={top === 14 ? "bf-list" : undefined} style={{ marginTop: top }}>
      <tbody>
        {children}
        <tr>
          <td colSpan={columns} className="bf-line" style={styles.rule}>
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ItemRow({ children, padding }: { children: ReactNode; padding: string }) {
  return (
    <tr>
      <td className="bf-line" style={{ borderTop: `1px solid ${color.line}`, padding }}>
        {children}
      </td>
    </tr>
  );
}

/** A label and its value side by side ("Plan" · "Bid Desk, annual"), for an ItemList with two columns. */
export function FactRow({ label, value }: { label: string; value: string }) {
  const cell: CSSProperties = { borderTop: `1px solid ${color.line}`, verticalAlign: "top", fontFamily: styles.itemMeta.fontFamily, fontSize: 15, lineHeight: 1.5 };
  return (
    <tr>
      <td className="bf-line bf-ink2 bf-fact-label" style={{ ...cell, padding: "10px 32px 10px 0", color: color.ink2, whiteSpace: "nowrap", width: "1%" }}>
        {label}
      </td>
      <td className="bf-line bf-ink bf-fact-value" style={{ ...cell, padding: "10px 0", color: color.ink }}>
        {value}
      </td>
    </tr>
  );
}

/** Text links in a row, each with a 44 px target. `lead` is the main action of the letter (16 px semibold). */
export function LinkRow({ links, variant = "item" }: { links: Array<EmailLink & { lead?: boolean }>; variant?: "item" | "lead" | "footer" }) {
  const styleOf = (link: { lead?: boolean }) => (variant === "lead" || link.lead ? styles.leadLink : variant === "footer" ? styles.footerLink : styles.itemLink);
  return (
    <table {...presentation}>
      <tbody>
        <tr>
          {links.map((link, index) => (
            <td key={link.url + index} height={44} style={{ ...styles.linkCell, paddingRight: index < links.length - 1 ? 24 : 0 }}>
              <a href={link.url} className="bf-link" style={{ ...styles.link, ...styleOf(link) }}>
                {link.label}
              </a>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** "● Closes 8 Jan 2027  [53 days left]" — amber marker, amber ink, a small pill for the time left. */
export function DeadlineLine({ text, left }: { text: string; left?: string | null }) {
  return (
    <p className="bf-amber" style={{ ...styles.deadline, marginTop: 6 }}>
      <span className="bf-dot" style={styles.dot}>
        ●
      </span>
      &nbsp;{text}
      {left ? (
        <>
          &nbsp;&nbsp;
          <span className="bf-pill" style={styles.pill}>
            {left}
          </span>
        </>
      ) : null}
    </p>
  );
}

function Footer({ reason, signOff, links, identity, top }: FooterModel & { top: number }) {
  return (
    <table {...presentation} width="100%" className={top > 20 ? "bf-footer-wide" : "bf-footer"} style={{ marginTop: top }}>
      <tbody>
        <tr>
          <td className="bf-line" style={{ borderTop: `1px solid ${color.line}`, paddingTop: 20 }}>
            <p className="bf-ink2" style={styles.footer}>
              {reason} {signOff}
            </p>
            {links.length > 0 ? <LinkRow variant="footer" links={links} /> : null}
            <p className="bf-ink2" style={{ ...styles.footer, marginTop: links.length > 0 ? 4 : 12 }}>
              {identity.map((part, index) =>
                part.placeholder ? (
                  <span key={index} style={styles.placeholder}>
                    {part.text}
                  </span>
                ) : (
                  <Fragment key={index}>{part.text}</Fragment>
                ),
              )}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
