import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { identityText } from "@/config/site";
import { emailColors } from "@/emails/layout";
import { emailText, greeting } from "@/emails/text";
import { renderEmail, type EmailTemplate } from "@/lib/email/templates";

/**
 * The transactional e-mails (src/emails): the frame of the e-mail artboards, a hand-written
 * plain-text part, and the promises the site makes about its mail.
 */
const ACTION = "https://bidfolio.co.uk/go?token=abc123";

const templates: Array<{ template: EmailTemplate; action: string; says: string[] }> = [
  { template: { name: "verify-email", props: { name: "Joanne Pike", url: ACTION } }, action: "Confirm my email", says: ["Joanne,", "This link works for 24 hours."] },
  { template: { name: "reset-password", props: { name: "Joanne Pike", url: ACTION } }, action: "Choose a new password", says: ["Joanne,", "This link works for 1 hour."] },
  {
    template: { name: "invitation", props: { inviterName: "Marcus Greaves", organizationName: "Aldermoor & Pike", role: "member", url: ACTION } },
    action: "Accept the invitation",
    says: ["Marcus Greaves has invited you to join Aldermoor & Pike on Bidfolio as a member.", "This invitation works for 7 days."],
  },
  {
    template: { name: "account-exists", props: { signInUrl: ACTION, resetUrl: "https://bidfolio.co.uk/forgot-password" } },
    action: "Sign in",
    says: ["Nothing was changed.", "https://bidfolio.co.uk/forgot-password"],
  },
];

const firstUrl = (text: string) => text.match(/https?:\/\/\S+/)?.[0];

describe("transactional e-mails", () => {
  for (const { template, action, says } of templates) {
    describe(template.name, () => {
      it("has a plain-text part written for reading, with the action link first", async () => {
        const { text } = await renderEmail(template);
        // The dev outbox and the end-to-end tests follow the first link of a message.
        expect(firstUrl(text)).toBe(ACTION);
        expect(text).toContain(`${action}:\n${ACTION}`);
        for (const sentence of says) expect(text).toContain(sentence);
        // No markup, no scraped leftovers, lines a person can read.
        expect(text).not.toMatch(/<[a-z]|&amp;|&#|\[https?:/);
        expect(text.split("\n").every((line) => line.length <= 420)).toBe(true);
      });

      it("ends with why it was sent and who sends it, in both parts", async () => {
        const { html, text } = await renderEmail(template);
        expect(text).toContain("\n-- \nYou get this because ");
        expect(text.trimEnd().endsWith(identityText)).toBe(true);
        const visible = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
        expect(visible).toContain("You get this because ");
        expect(visible).toContain("Bidfolio is operated by Maksym Pokhylyi");
        expect(visible).toContain("not affiliated with, or endorsed by, the UK Government");
      });

      it("renders the frame of the artboards: one sheet of 600 px, the action as a link, nothing fetched on opening", async () => {
        const { html } = await renderEmail(template);
        expect(html).toContain(`href="${ACTION.replace("&", "&amp;")}"`);
        expect(html).toContain("max-width:600px");
        // "No tracking pixels in our emails": no image and nothing else loaded from a server.
        expect(html).not.toMatch(/<img\b/i);
        expect(html).not.toMatch(/<link\b[^>]*href/i);
        expect(html).not.toMatch(/url\(/i);
        expect(html).toContain('name="color-scheme" content="light dark"');
        expect(html).toContain('lang="en-GB"');
      });

      it("uses the product's spelling", async () => {
        const { subject, html, text } = await renderEmail(template);
        for (const part of [subject, text, html.replace(/<[^>]+>/g, " ")]) expect(part).not.toMatch(/\be-mail/i);
      });
    });
  }

  it("keeps the subjects people search their inbox for", async () => {
    const subjects = await Promise.all(templates.map(async ({ template }) => (await renderEmail(template)).subject));
    expect(subjects).toEqual([
      "Confirm your email to open your radar",
      "Reset your Bidfolio password",
      "Marcus Greaves invited you to Aldermoor & Pike on Bidfolio",
      "You already have a Bidfolio account",
    ]);
  });

  it("greets with a plain first name only: the name was typed by whoever filled in the form", () => {
    expect(greeting("Joanne Pike")).toBe("Joanne,");
    expect(greeting("  seán  ")).toBe("seán,");
    expect(greeting("O’Neill-Smith Joanne")).toBe("O’Neill-Smith,");
    expect(greeting("")).toBe("Hello,");
    expect(greeting(null)).toBe("Hello,");
    // Not a name: a web address, a sentence, a very long word.
    expect(greeting("www.example.com wins")).toBe("Hello,");
    expect(greeting("Click http://example.com")).toBe("Click,");
    expect(greeting("https://example.com")).toBe("Hello,");
    expect(greeting("A".repeat(40))).toBe("Hello,");
    expect(greeting("Prize!!! now")).toBe("Hello,");
  });

  it("builds the text part in a fixed order", () => {
    const text = emailText({ greeting: "Hello,", before: ["One."], action: { label: "Do it", url: ACTION, note: "Soon." }, after: ["Two."], reason: "You get this because of a test." });
    expect(text).toBe(`Hello,\n\nOne.\n\nDo it:\n${ACTION}\nSoon.\n\nTwo.\n\n-- \nYou get this because of a test.\n\n${identityText}\n`);
  });

  it("uses the design tokens for its colours", () => {
    const css = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
    expect(emailColors).toEqual({
      paperDeep: token("paper-deep"),
      surface: token("surface"),
      ink: token("ink"),
      ink2: token("ink-2"),
      line: token("line"),
      brand: token("brand"),
      accent: token("accent"),
      accentInk: token("accent-ink"),
    });
  });
});
