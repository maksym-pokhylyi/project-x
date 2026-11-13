import { Button, Heading, Text } from "@react-email/components";
import { site } from "@/config/site";
import { EmailLayout, emailStyles } from "./layout";

export type AccountExistsProps = { signInUrl: string; resetUrl: string };

export const accountExistsSubject = `You already have a ${site.name} account`;

/**
 * Sent when someone tries to sign up with an address that already has a verified account.
 * The sign-up form deliberately shows the same "check your inbox" message either way, so
 * this e-mail is what stops that from being a dead end for the real owner. It contains no
 * token and nothing the person who typed the address supplied.
 */
export function AccountExists({ signInUrl, resetUrl }: AccountExistsProps) {
  return (
    <EmailLayout preview={`Someone tried to create a ${site.name} account with this address.`}>
      <Heading style={emailStyles.heading}>You already have an account</Heading>
      <Text style={emailStyles.paragraph}>
        Someone just tried to create a {site.name} account with this e-mail address, but one already exists. Nothing
        was changed.
      </Text>
      <Text style={emailStyles.paragraph}>If that was you, sign in instead — or reset your password if you have forgotten it.</Text>
      <Button href={signInUrl} style={emailStyles.button}>
        Sign in
      </Button>
      <Text style={emailStyles.muted}>
        Forgot your password? {resetUrl}
        <br />
        If this was not you, you can ignore this e-mail: your account is unaffected.
      </Text>
    </EmailLayout>
  );
}
