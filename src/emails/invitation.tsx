import { Button, Heading, Text } from "@react-email/components";
import { site } from "@/config/site";
import { EmailLayout, emailStyles } from "./layout";

export type InvitationProps = { inviterName: string; organizationName: string; role: string; url: string };

export function invitationSubject(props: Pick<InvitationProps, "inviterName" | "organizationName">) {
  return `${props.inviterName} invited you to ${props.organizationName} on ${site.name}`;
}

export function Invitation({ inviterName, organizationName, role, url }: InvitationProps) {
  return (
    <EmailLayout preview={`Join ${organizationName} on ${site.name}.`}>
      <Heading style={emailStyles.heading}>Join {organizationName}</Heading>
      <Text style={emailStyles.paragraph}>
        {inviterName} invited you to join the <strong>{organizationName}</strong> workspace on {site.name} as{" "}
        {role === "admin" ? "an admin" : `a ${role}`}.
      </Text>
      <Button href={url} style={emailStyles.button}>
        Accept invitation
      </Button>
      <Text style={emailStyles.muted}>
        If the button does not work, copy this link into your browser: {url}
        <br />
        This invitation expires in 7 days. If you were not expecting it, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
