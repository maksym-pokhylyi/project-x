import { Button, Heading, Text } from "@react-email/components";
import { site } from "@/config/site";
import { EmailLayout, emailStyles } from "./layout";

export type VerifyEmailProps = { name: string; url: string };

export const verifyEmailSubject = `Verify your e-mail for ${site.name}`;

export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailLayout preview={`Confirm your e-mail address to start using ${site.name}.`}>
      <Heading style={emailStyles.heading}>Confirm your e-mail address</Heading>
      <Text style={emailStyles.paragraph}>
        Hi {name || "there"}, thanks for signing up for {site.name}. Confirm your address to activate your account.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Verify e-mail
      </Button>
      <Text style={emailStyles.muted}>
        If the button does not work, copy this link into your browser: {url}
        <br />
        If you did not create an account, you can ignore this e-mail.
      </Text>
    </EmailLayout>
  );
}
