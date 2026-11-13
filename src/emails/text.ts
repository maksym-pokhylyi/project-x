import { identityText } from "@/config/site";

/**
 * The plain-text part of a message, written on purpose rather than scraped from the HTML:
 * short lines, the action as "Label:" with the address on the next line, and the same two
 * closing paragraphs as the HTML frame (why you got this, who sends it).
 *
 * The action's address is the FIRST address in the text. The dev outbox and the end-to-end
 * tests follow "the first link" of a message, and so do people who only see the text part.
 */
export type EmailTextParts = {
  /** "Joanne," or "Hello," (see greeting()). */
  greeting: string;
  /** Paragraphs before the action. */
  before: string[];
  /** The one thing to do. `note` says how long the link works. */
  action?: { label: string; url: string; note?: string };
  /** Paragraphs after the action. */
  after?: string[];
  /** "You get this because …" */
  reason: string;
};

export function emailText({ greeting: hello, before, action, after = [], reason }: EmailTextParts): string {
  const blocks = [hello, ...before];
  if (action) blocks.push([`${action.label}:`, action.url, action.note].filter(Boolean).join("\n"));
  blocks.push(...after);
  // "-- " on its own line is the conventional signature separator.
  return `${blocks.join("\n\n")}\n\n-- \n${reason}\n\n${identityText}\n`;
}

/**
 * The first line of a message: the person's first name and a comma, as in the artboards
 * ("Joanne,"). The name was typed into a form by whoever signed up, and the message may go
 * to somebody else's address, so only a plain first name is used (letters, an apostrophe or
 * a hyphen, 24 characters at most); anything else gets "Hello,".
 */
export function greeting(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return /^\p{L}[\p{L}'’-]{0,23}$/u.test(first) ? `${first},` : "Hello,";
}
