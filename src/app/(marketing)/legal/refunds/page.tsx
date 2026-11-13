import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { trialIncludes } from "@/config/billing-copy";
import { BID_PASS_DISPLAY as BID_PASS } from "@/config/plan-display";
import { operatorAddress, operatorLegalName, site } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund policy",
  description: `${site.name} refunds: ${site.legal.refundWindowDays} days from your first payment, how to ask, and how cancellations, trials and the Bid Pass are treated.`,
  alternates: { canonical: "/legal/refunds" },
};

const days = site.legal.refundWindowDays;
const { facts, operator } = site;

const summary = [
  `Subscriptions: ask within ${days} days of your first payment and we refund it in full. You do not need to give a reason.`,
  `${BID_PASS.name}: refunded in full within ${days} days if it has not been used.`,
  "Cancel at any time in two clicks. Cancelling stops the next renewal; you keep what you have paid for until the end of the period.",
];

const sections: LegalSection[] = [
  {
    heading: "Who we are, and who processes payments and refunds",
    id: "who",
    body: [
      `${site.name} is operated by ${operatorLegalName}, a ${operator.legalForm} registered in ${operator.address.country}, of ${operatorAddress}.`,
      "Every purchase is made through Paddle.com, our merchant of record: Paddle is the seller on your receipt. Paddle takes the payment, issues your invoice and pays refunds back to the original payment method on our behalf.",
    ],
  },
  {
    heading: `${days}-day refund on subscriptions`,
    id: "subscriptions",
    body: [
      `If a paid plan is not right for you, ask for a refund within ${days} days of your first payment for that subscription and we will refund that payment in full. You do not need to give a reason.`,
      "This applies to the first payment of a monthly plan and of an annual plan. It applies once per workspace for each plan.",
    ],
  },
  {
    heading: `Trials on Bid Desk`,
    id: "trials",
    body: [
      `Bid Desk can be started with a ${facts.trialDays}-day trial. ${trialIncludes} A card is required, and nothing is charged during the trial. If you cancel before the trial ends, you pay nothing.`,
      `If the trial ends and the first payment is taken, the ${days}-day refund above runs from the date of that payment.`,
    ],
  },
  {
    heading: `${BID_PASS.name}`,
    id: "bid-pass",
    body: [
      `A ${BID_PASS.name} is a one-off payment for one full bid. If you have not used it, ask within ${days} days of buying it and we refund it in full.`,
      "A pass counts as used once a tender pack has been processed with it. If processing failed and you received no usable result, tell us: we will restore the pass or refund it, whichever you prefer.",
    ],
  },
  {
    heading: "Renewals",
    id: "renewals",
    body: [
      `Renewal payments are not normally refunded, which is why we remind you by email ${facts.renewalReminderDays} days before an annual plan renews.`,
      "If an annual plan renewed and you meant to cancel, write to us within 7 days of the charge. If the plan has not been used since it renewed, we refund the renewal.",
    ],
  },
  {
    heading: "Cancelling and pausing",
    id: "cancelling",
    body: [
      "You can cancel from Billing at any time: it takes two clicks. Cancelling stops future renewals. The workspace keeps its paid features until the end of the period already paid for, then returns to the free plan. Your data stays.",
      "You can also pause a subscription for one to three months. Nothing is charged while it is paused.",
    ],
  },
  {
    heading: "How to ask for a refund",
    id: "how",
    body: [
      `Email ${site.supportEmail} from the address on the account, with the name of the workspace and, if you have it, the Paddle order number from your receipt. You can also use the link in your Paddle receipt.`,
      "We confirm within two working days. Approved refunds go back to the original payment method; depending on your bank, the money usually arrives within 5 to 10 working days.",
    ],
  },
  {
    heading: "When we may refuse",
    id: "exceptions",
    body: [
      "We may refuse a refund where there is evidence of abuse, such as repeated purchases and refunds, or a serious breach of the [Terms of Service](/legal/terms).",
      "Nothing in this policy limits any right you have under law that cannot be excluded.",
    ],
  },
];

export default function RefundsPage() {
  return (
    <LegalDocument
      title="Refund policy"
      intro={`When and how you can get your money back for a ${site.name} subscription or a ${BID_PASS.name}.`}
      summary={summary}
      sections={sections}
    />
  );
}
