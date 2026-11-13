import { site } from "@/config/site";
import { EmailAction, EmailLayout, EmailText } from "./layout";
import { emailText } from "./text";

export type InvitationProps = { inviterName: string; organizationName: string; role: string; url: string };

export function invitationSubject(props: Pick<InvitationProps, "inviterName" | "organizationName">) {
  return `${props.inviterName} invited you to ${props.organizationName} on ${site.name}`;
}

/* The invitation is valid for 7 days: invitationExpiresIn in src/lib/auth.ts. */
function copy({ inviterName, organizationName, role }: Omit<InvitationProps, "url">) {
  return {
    preview: `Join ${organizationName} on ${site.name}.`,
    body: `${inviterName} has invited you to join ${organizationName} on ${site.name} as ${role === "admin" ? "an admin" : `a ${role}`}.`,
    about: `${site.name} is where small suppliers find public tenders that fit them and check a tender pack before they bid.`,
    action: "Accept the invitation",
    validity: "This invitation works for 7 days.",
    ignore: "If you were not expecting it, ignore this message and nothing will change.",
    reason: `You get this because ${inviterName} entered this address when inviting a teammate.`,
  };
}

/** "X invited you to Y": sent when an owner or admin invites someone to a workspace. */
export function Invitation({ url, ...props }: InvitationProps) {
  const text = copy(props);
  return (
    <EmailLayout preview={text.preview} reason={text.reason}>
      <EmailText first>Hello,</EmailText>
      <EmailText>{text.body}</EmailText>
      <EmailText>{text.about}</EmailText>
      <EmailAction href={url} note={text.validity}>
        {text.action}
      </EmailAction>
      <EmailText spaced>{text.ignore}</EmailText>
    </EmailLayout>
  );
}

export function invitationText({ url, ...props }: InvitationProps): string {
  const text = copy(props);
  return emailText({
    greeting: "Hello,",
    before: [text.body, text.about],
    action: { label: text.action, url, note: text.validity },
    after: [text.ignore],
    reason: text.reason,
  });
}
