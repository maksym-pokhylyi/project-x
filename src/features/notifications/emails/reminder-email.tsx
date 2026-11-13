import type { ReactElement } from "react";
import { DeadlineLine, EmailFrame, Headline, ItemList, ItemRow, LinkRow, Paragraph, SectionHeading, type EmailLink, type FooterModel } from "./parts";
import { textDocument, textLines } from "./text";
import { styles } from "./theme";

/**
 * Deadline reminder, as drawn in docs/design/handoff/EmailDeadline-640.dc.html: the one
 * sentence that matters in semibold, the tender between two hairlines with its closing
 * time in amber, a link, and the reminder that bids go in through the buyer's portal.
 *
 * One tender is laid out exactly like the artboard. Several tenders due on the same day
 * share one letter: the same block per tender, each with its own links.
 *
 * `progress` is the artboard's "Where your bid stands" list. It is empty for tenders saved
 * on the radar and filled by the bids module for a bid in progress (see the deadline
 * sources in ../content/reminders.ts).
 */
export type ReminderEmailItem = {
  key: string;
  title: string;
  buyer: string | null;
  /** One tender: "Closes Fri 27 Nov 2026, 12:00 noon". Several: "Closes in 2 days: Thu 26 Nov 2026, 12:00 noon". */
  closes: string;
  /** Where the work on it stands, one fact per line. */
  progress: string[];
  /** "Open on Bidfolio" first, then the buyer's notice. */
  links: EmailLink[];
};

export type ReminderEmailProps = {
  subject: string;
  preview: string;
  greeting: string;
  /** "This tender closes in 3 days." */
  headline: string;
  items: ReminderEmailItem[];
  note: string;
  markUrl: string;
  markDarkUrl: string;
  footer: FooterModel;
};

const PROGRESS = "Where your bid stands";

function TenderBlock({ item }: { item: ReminderEmailItem }) {
  return (
    <>
      <p className="bf-ink" style={styles.itemTitle}>
        {item.title}
      </p>
      {item.buyer ? (
        <p className="bf-ink" style={{ ...styles.itemMeta, marginTop: 6 }}>
          {item.buyer}
        </p>
      ) : null}
      <DeadlineLine text={item.closes} />
    </>
  );
}

function ProgressList({ lines }: { lines: string[] }) {
  return (
    <ItemList>
      {lines.map((line) => (
        <ItemRow key={line} padding="10px 0">
          <p className="bf-ink" style={styles.itemMeta}>
            {line}
          </p>
        </ItemRow>
      ))}
    </ItemList>
  );
}

const withLead = (links: EmailLink[]) => links.map((link, index) => ({ ...link, lead: index === 0 }));

export function ReminderEmail(props: ReminderEmailProps) {
  const single = props.items.length === 1 ? props.items[0]! : null;
  return (
    <EmailFrame preview={props.preview} markUrl={props.markUrl} markDarkUrl={props.markDarkUrl} footer={props.footer} footerTop={28}>
      <Paragraph top={24} className="bf-first">
        {props.greeting}
      </Paragraph>
      <Headline>{props.headline}</Headline>

      {single ? (
        <>
          <ItemList top={20}>
            <ItemRow padding="16px 0">
              <TenderBlock item={single} />
            </ItemRow>
          </ItemList>
          {single.progress.length > 0 ? (
            <>
              <SectionHeading title={PROGRESS} />
              <ProgressList lines={single.progress} />
            </>
          ) : null}
          <div style={{ marginTop: 6 }}>
            <LinkRow links={withLead(single.links)} />
          </div>
        </>
      ) : (
        <ItemList top={20}>
          {props.items.map((item) => (
            <ItemRow key={item.key} padding="16px 0 2px">
              <TenderBlock item={item} />
              {item.progress.map((line) => (
                <p key={line} className="bf-ink2" style={{ ...styles.itemMuted, marginTop: 6 }}>
                  {line}
                </p>
              ))}
              <LinkRow links={item.links} />
            </ItemRow>
          ))}
        </ItemList>
      )}

      <Paragraph top={single ? 6 : 20}>{props.note}</Paragraph>
    </EmailFrame>
  );
}

export function reminderEmailText(props: ReminderEmailProps): string {
  return textDocument(
    [
      props.greeting,
      props.headline,
      ...props.items.map((item) =>
        textLines([
          item.title,
          item.buyer,
          item.closes,
          ...(item.progress.length > 0 ? [`${PROGRESS}:`, ...item.progress.map((line) => `- ${line}`)] : []),
          ...item.links.map((link) => `${link.label}: ${link.url}`),
        ]),
      ),
      props.note,
    ],
    props.footer,
  );
}

/** For src/lib/email/templates.tsx. */
export function reminderEmail(props: ReminderEmailProps): { subject: string; element: ReactElement; text: string } {
  return { subject: props.subject, element: <ReminderEmail {...props} />, text: reminderEmailText(props) };
}
