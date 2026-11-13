import { site } from "@/config/site";
import { EmailAction, EmailLayout, EmailLink, EmailText } from "./layout";
import { emailText } from "./text";

export type AccountExistsProps = { signInUrl: string; resetUrl: string };

export const accountExistsSubject = `You already have a ${site.name} account`;

const copy = {
  preview: `Someone tried to create a ${site.name} account with this address. Nothing was changed.`,
  body: `Someone tried to create a ${site.name} account with this address, but it already has one. Nothing was changed.`,
  you: "If that was you, sign in instead.",
  action: "Sign in",
  forgot: "Forgotten your password?",
  reset: "Reset it",
  ignore: "If that was not you, ignore this message: your account is not affected.",
  reason: "You get this because this address was entered in our sign-up form.",
};

/**
 * Sent when someone tries to sign up with an address that already has a verified account.
 * The sign-up form deliberately shows the same "check your inbox" message either way, so
 * this e-mail is what stops that from being a dead end for the real owner. It contains no
 * token and nothing the person who typed the address supplied.
 */
export function AccountExists({ signInUrl, resetUrl }: AccountExistsProps) {
  return (
    <EmailLayout preview={copy.preview} reason={copy.reason}>
      <EmailText first>Hello,</EmailText>
      <EmailText>{copy.body}</EmailText>
      <EmailText>{copy.you}</EmailText>
      <EmailAction href={signInUrl}>{copy.action}</EmailAction>
      <EmailText>
        {copy.forgot} <EmailLink href={resetUrl}>{copy.reset}</EmailLink>.
      </EmailText>
      <EmailText spaced>{copy.ignore}</EmailText>
    </EmailLayout>
  );
}

export function accountExistsText({ signInUrl, resetUrl }: AccountExistsProps): string {
  return emailText({
    greeting: "Hello,",
    before: [copy.body, copy.you],
    action: { label: copy.action, url: signInUrl },
    after: [`${copy.forgot} ${copy.reset}:\n${resetUrl}`, copy.ignore],
    reason: copy.reason,
  });
}
