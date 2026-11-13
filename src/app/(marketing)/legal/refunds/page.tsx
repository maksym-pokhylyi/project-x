import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Refund Policy", alternates: { canonical: "/legal/refunds" } };

const days = site.legal.refundWindowDays;

const sections: LegalSection[] = [
  {
    heading: "Who processes payments",
    body: [
      "Purchases are made through Paddle.com, our merchant of record. Paddle issues your invoice and processes refunds on our behalf.",
    ],
  },
  {
    heading: `${days}-day money-back guarantee`,
    body: [
      `If you are not satisfied with a paid plan, ask for a refund within ${days} days of your first payment for that subscription and we will refund it in full.`,
      "Renewal payments are generally not refundable. If you forgot to cancel before an annual renewal, contact us within 7 days of the charge and we will refund the unused renewal where we reasonably can.",
    ],
  },
  {
    heading: "How to request a refund",
    body: [
      `E-mail ${site.supportEmail} from the address on the account, with the workspace name and the Paddle order number from your receipt. You can also use the link in your Paddle receipt.`,
      "Approved refunds are returned to the original payment method. Depending on your bank this usually takes 5–10 business days.",
    ],
  },
  {
    heading: "Cancellations",
    body: [
      "You can cancel at any time from Settings → Billing. Cancelling stops future renewals; the workspace keeps its paid features until the end of the period already paid for.",
    ],
  },
  {
    heading: "Exceptions",
    body: [
      "We may refuse a refund where there is evidence of abuse (for example repeated purchases and refunds) or a breach of the Terms of Service.",
      "Nothing in this policy limits rights you have under mandatory consumer law.",
    ],
  },
];

export default function RefundsPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      intro={`This policy explains when and how you can get your money back for ${site.name} subscriptions.`}
      sections={sections}
    />
  );
}
