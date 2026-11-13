import { site } from "@/config/site";
import { EmailAction, EmailLayout, EmailText } from "./layout";
import { emailText, greeting } from "./text";

export type ResetPasswordProps = { name: string; url: string };

export const resetPasswordSubject = `Reset your ${site.name} password`;

/* The link is valid for 1 hour: resetPasswordTokenExpiresIn in src/lib/auth.ts. */
const copy = {
  preview: `Choose a new password for your ${site.name} account.`,
  body: `Someone asked to reset the password of your ${site.name} account. If that was you, choose a new one.`,
  action: "Choose a new password",
  validity: "This link works for 1 hour.",
  ignore: "If you did not ask for this, ignore this message: your password stays as it is.",
  reason: "You get this because a password reset was requested for this address.",
};

/** "Reset your password": sent from the "Forgot your password?" form. */
export function ResetPassword({ name, url }: ResetPasswordProps) {
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

export function resetPasswordText({ name, url }: ResetPasswordProps): string {
  return emailText({
    greeting: greeting(name),
    before: [copy.body],
    action: { label: copy.action, url, note: copy.validity },
    after: [copy.ignore],
    reason: copy.reason,
  });
}
