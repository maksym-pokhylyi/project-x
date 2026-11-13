import type { ReactElement } from "react";
import type { ContractLine, TenderLine } from "../content/digest";
import { DeadlineLine, EmailFrame, ItemList, ItemRow, LinkRow, Paragraph, SectionHeading, type FooterModel } from "./parts";
import { textDocument, textHeading, textLines } from "./text";
import { styles } from "./theme";

/**
 * The weekly digest and the daily alert: one template family, as drawn in
 * docs/design/handoff/Digest-640.dc.html. The alert is the same letter with the matches
 * section only.
 *
 * The props are finished sentences and addresses (see ../compose.ts); the template adds
 * nothing of its own, so the HTML and the text version cannot say different things.
 */
export type LinkedTender = TenderLine & { url: string };
export type LinkedContract = ContractLine & { url: string };

export type RadarEmailProps = {
  kind: "digest" | "alert";
  subject: string;
  preview: string;
  greeting: string;
  intro: string;
  matches: { note: string; items: LinkedTender[] } | null;
  /** The one line a capped plan gets under its matches. */
  cap: { text: string; linkLabel: string; url: string } | null;
  ending: { note: string; items: LinkedContract[] } | null;
  saved: { note: string; items: LinkedTender[] } | null;
  closing: string;
  radarUrl: string;
  markUrl: string;
  markDarkUrl: string;
  footer: FooterModel;
};

const OPEN = "Open on Bidfolio";
const joinDot = (parts: Array<string | null>) => parts.filter(Boolean).join(" · ");

function TenderRow({ item }: { item: LinkedTender }) {
  const meta = joinDot([item.buyer, item.value]);
  return (
    <ItemRow padding="4px 0 2px">
      <h3 className="bf-ink" style={{ ...styles.itemTitle, margin: "12px 0 9px" }}>
        {item.title}
      </h3>
      {meta ? (
        <p className="bf-ink" style={styles.itemMeta}>
          {meta}
        </p>
      ) : null}
      <DeadlineLine text={item.closes} left={item.left} />
      {item.reason ? (
        <p className="bf-ink2" style={{ ...styles.itemMuted, marginTop: 6 }}>
          {item.reason}
        </p>
      ) : null}
      <LinkRow links={[{ label: OPEN, url: item.url }]} />
    </ItemRow>
  );
}

function ContractRow({ item }: { item: LinkedContract }) {
  const meta = joinDot([item.buyer, item.value]);
  return (
    <ItemRow padding="16px 0 2px">
      <h3 className="bf-ink" style={styles.itemTitle}>
        {item.title}
      </h3>
      <p className="bf-ink" style={{ ...styles.itemMeta, marginTop: 6 }}>
        {item.heldBy}
      </p>
      {meta ? (
        <p className="bf-ink2" style={{ ...styles.itemMuted, marginTop: 2 }}>
          {meta}
        </p>
      ) : null}
      <p className="bf-ink" style={{ ...styles.itemStrong, marginTop: 6 }}>
        {item.ends}
      </p>
      <LinkRow links={[{ label: OPEN, url: item.url }]} />
    </ItemRow>
  );
}

export function RadarEmail(props: RadarEmailProps) {
  return (
    <EmailFrame preview={props.preview} markUrl={props.markUrl} markDarkUrl={props.markDarkUrl} footer={props.footer}>
      <Paragraph top={24} className="bf-first">
        {props.greeting}
      </Paragraph>
      <Paragraph>{props.intro}</Paragraph>

      {props.matches ? (
        <>
          <SectionHeading title="New matches" note={props.matches.note} />
          <ItemList>
            {props.matches.items.map((item) => (
              <TenderRow key={item.ocid} item={item} />
            ))}
          </ItemList>
        </>
      ) : null}
      {props.cap ? (
        <Paragraph top={16} style={{ fontSize: 15 }}>
          {props.cap.text}{" "}
          <a href={props.cap.url} className="bf-link" style={{ ...styles.link, whiteSpace: "nowrap" }}>
            {props.cap.linkLabel}
          </a>
        </Paragraph>
      ) : null}

      {props.ending ? (
        <>
          <SectionHeading title="Contracts ending soon" note={props.ending.note} />
          <ItemList>
            {props.ending.items.map((item) => (
              <ContractRow key={`${item.ocid}|${item.supplierId}`} item={item} />
            ))}
          </ItemList>
        </>
      ) : null}

      {props.saved ? (
        <>
          <SectionHeading title="Saved tenders closing soon" note={props.saved.note} />
          <ItemList>
            {props.saved.items.map((item) => (
              <TenderRow key={item.ocid} item={item} />
            ))}
          </ItemList>
        </>
      ) : null}

      <Paragraph top={28} className="bf-closing">
        {props.closing}
      </Paragraph>
      <LinkRow variant="lead" links={[{ label: "Open your radar", url: props.radarUrl }]} />
    </EmailFrame>
  );
}

const tenderText = (item: LinkedTender) =>
  textLines([item.title, joinDot([item.buyer, item.value]), item.left ? `${item.closes} (${item.left})` : item.closes, item.reason, `${OPEN}: ${item.url}`]);

const contractText = (item: LinkedContract) => textLines([item.title, item.heldBy, joinDot([item.buyer, item.value]), item.ends, `${OPEN}: ${item.url}`]);

export function radarEmailText(props: RadarEmailProps): string {
  return textDocument(
    [
      props.greeting,
      props.intro,
      props.matches ? textHeading("New matches", props.matches.note) : null,
      ...(props.matches?.items.map(tenderText) ?? []),
      props.cap ? `${props.cap.text} ${props.cap.linkLabel}: ${props.cap.url}` : null,
      props.ending ? textHeading("Contracts ending soon", props.ending.note) : null,
      ...(props.ending?.items.map(contractText) ?? []),
      props.saved ? textHeading("Saved tenders closing soon", props.saved.note) : null,
      ...(props.saved?.items.map(tenderText) ?? []),
      textLines([props.closing, `Open your radar: ${props.radarUrl}`]),
    ],
    props.footer,
  );
}

/** For src/lib/email/templates.tsx. */
export function radarEmail(props: RadarEmailProps): { subject: string; element: ReactElement; text: string } {
  return { subject: props.subject, element: <RadarEmail {...props} />, text: radarEmailText(props) };
}
