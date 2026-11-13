import type { ReactElement } from "react";
import { EmailFrame, FactRow, Headline, ItemList, LinkRow, Paragraph, type FooterModel } from "./parts";
import { textDocument, textLines } from "./text";

/**
 * Annual-renewal reminder, as drawn in docs/design/handoff/EmailRenewal-640.dc.html: what
 * renews and when in one semibold sentence, the facts as a short table, what to do (nothing,
 * or two clicks in Billing), one link. Sent once per paid year to the workspace's owners.
 *
 * A billing notice, not a sales letter — and deliberately without the 14-day refund line:
 * that covers a FIRST subscription payment only, and a renewal is not one.
 */
export type RenewalEmailProps = {
  subject: string;
  preview: string;
  greeting: string;
  /** "Your Bid Desk annual plan renews on 27 Nov 2027 for £1,490 (plus VAT where it applies)." */
  headline: string;
  /** Plan, price (when we hold it), renewal date. */
  facts: Array<{ label: string; value: string }>;
  body: string;
  billingUrl: string;
  markUrl: string;
  markDarkUrl: string;
  footer: FooterModel;
};

const BILLING = "Open Billing";

export function RenewalEmail(props: RenewalEmailProps) {
  return (
    <EmailFrame preview={props.preview} markUrl={props.markUrl} markDarkUrl={props.markDarkUrl} footer={props.footer}>
      <Paragraph top={24} className="bf-first">
        {props.greeting}
      </Paragraph>
      <Headline>{props.headline}</Headline>
      <ItemList top={20} columns={2}>
        {props.facts.map((fact) => (
          <FactRow key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </ItemList>
      <Paragraph top={20}>{props.body}</Paragraph>
      <div style={{ marginTop: 6 }}>
        <LinkRow variant="lead" links={[{ label: BILLING, url: props.billingUrl }]} />
      </div>
    </EmailFrame>
  );
}

export function renewalEmailText(props: RenewalEmailProps): string {
  return textDocument(
    [props.greeting, props.headline, textLines(props.facts.map((fact) => `${fact.label}: ${fact.value}`)), textLines([props.body, `${BILLING}: ${props.billingUrl}`])],
    props.footer,
  );
}

/** For src/lib/email/templates.tsx. */
export function renewalEmail(props: RenewalEmailProps): { subject: string; element: ReactElement; text: string } {
  return { subject: props.subject, element: <RenewalEmail {...props} />, text: renewalEmailText(props) };
}
