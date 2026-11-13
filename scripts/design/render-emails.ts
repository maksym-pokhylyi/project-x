/**
 * Writes every transactional e-mail with sample data as <name>.html and <name>.txt, so the
 * frame can be looked at in a browser and the text part read as a person would.
 *
 *   pnpm exec tsx scripts/design/render-emails.ts [out dir]      default: .emails-preview
 *
 * scripts/design/emails.mjs runs this and captures the HTML at 640 and 390 px, light and dark.
 * The sample data is that of the artboards (fictional).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderEmail, type EmailTemplate } from "../../src/lib/email/templates";

const out = resolve(process.argv[2] ?? ".emails-preview");
const url = "https://bidfolio.co.uk/api/auth/verify-email?token=sample";

const samples: EmailTemplate[] = [
  { name: "verify-email", props: { name: "Joanne Pike", url } },
  { name: "reset-password", props: { name: "Joanne Pike", url: "https://bidfolio.co.uk/reset-password?token=sample" } },
  { name: "invitation", props: { inviterName: "Joanne Pike", organizationName: "Aldermoor & Pike Building Services Ltd", role: "member", url: "https://bidfolio.co.uk/accept-invitation/sample" } },
  { name: "account-exists", props: { signInUrl: "https://bidfolio.co.uk/sign-in", resetUrl: "https://bidfolio.co.uk/forgot-password" } },
  // The bid desk's message: not restyled here, shown because it lives in the same frame.
  {
    name: "brief-ready",
    props: {
      name: "Joanne",
      bidTitle: "Planned and responsive maintenance of corporate buildings 2027–2031",
      buyerName: "Calderbrook Metropolitan Borough Council",
      deadline: "Closes 27 Nov 2026, 12:00 · 14 days left",
      verdict: "Worth bidding, if you close two gaps first.",
      requirements: 31,
      passFail: 23,
      questions: 6,
      citations: { verified: 29, total: 31 },
      gates: { total: 23, met: 19, confirm: 2, gaps: 2 },
      gapNames: ["no DBS register", "no Cyber Essentials certificate"],
      scoredQuestions: 6,
      coverage: "6 files, 214 pages read · 1 file not read",
      url: "https://bidfolio.co.uk/app/bids/sample",
    },
  },
];

async function main() {
  mkdirSync(out, { recursive: true });
  for (const sample of samples) {
    const { subject, html, text } = await renderEmail(sample);
    writeFileSync(join(out, `${sample.name}.html`), html);
    writeFileSync(join(out, `${sample.name}.txt`), `Subject: ${subject}\n\n${text}`);
    process.stdout.write(`${sample.name}: ${subject}\n`);
  }
}

void main();
