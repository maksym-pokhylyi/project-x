import { site } from "@/config/site";
import { EmailAction, EmailLayout, EmailText } from "./layout";
import { emailText, greeting } from "./text";

export type VerifyEmailProps = { name: string; url: string };

/** As on the EmailConfirm artboard. */
export const verifyEmailSubject = "Confirm your email to open your radar";

/* The link is valid for 24 hours: VERIFICATION_LINK_TTL_SECONDS in src/lib/auth.ts. */
const copy = {
  preview: `Confirm this address to finish setting up your ${site.name} account.`,
  body: `Confirm this address to finish setting up your ${site.name} account and open your radar.`,
  action: "Confirm my email",
  validity: "This link works for 24 hours.",
  ignore: "If you did not ask for this, ignore this message and nothing will change.",
  reason: `You get this because someone used this address to create a ${site.name} account.`,
};

/** "Confirm your email": sent after sign-up, and again when someone signs in before confirming. */
export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailLayout preview={copy.preview} reason={copy.reason}>
      <EmailText first>{greeting(name)}</EmailText>
      <EmailText>{copy.body}</EmailText>
      <EmailAction href={url} note={copy.validity}>
        {copy.action}
      </EmailAction>
      <EmailText spaced>{copy.ignore}</EmailText>
    </EmailLayout>
  );
}

export function verifyEmailText({ name, url }: VerifyEmailProps): string {
  return emailText({
    greeting: greeting(name),
    before: [copy.body],
    action: { label: copy.action, url, note: copy.validity },
    after: [copy.ignore],
    reason: copy.reason,
  });
}
