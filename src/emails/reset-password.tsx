import { Button, Heading, Text } from "@react-email/components";
import { site } from "@/config/site";
import { EmailLayout, emailStyles } from "./layout";

export type ResetPasswordProps = { name: string; url: string };

export const resetPasswordSubject = `Reset your ${site.name} password`;

export function ResetPassword({ name, url }: ResetPasswordProps) {
  return (
    <EmailLayout preview={`Reset the password for your ${site.name} account.`}>
      <Heading style={emailStyles.heading}>Reset your password</Heading>
      <Text style={emailStyles.paragraph}>
        Hi {name || "there"}, we received a request to reset your password. The link below is valid for 1 hour.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Choose a new password
      </Button>
      <Text style={emailStyles.muted}>
        If the button does not work, copy this link into your browser: {url}
        <br />
        If you did not request this, you can ignore this e-mail — your password stays unchanged.
      </Text>
    </EmailLayout>
  );
}
