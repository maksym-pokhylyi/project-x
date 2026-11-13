import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { AccountExists, accountExistsSubject, accountExistsText, type AccountExistsProps } from "@/emails/account-exists";
import { BriefReady, briefReadySubject, type BriefReadyProps } from "@/emails/brief-ready";
import { Invitation, invitationSubject, invitationText, type InvitationProps } from "@/emails/invitation";
import { ResetPassword, resetPasswordSubject, resetPasswordText, type ResetPasswordProps } from "@/emails/reset-password";
import { VerifyEmail, verifyEmailSubject, verifyEmailText, type VerifyEmailProps } from "@/emails/verify-email";

/**
 * All transactional e-mails the app can send. To add one: create the React Email
 * component in src/emails (inside <EmailLayout>, with a plain-text function built on
 * emailText() from src/emails/text.ts), add a variant here and a case in renderEmail().
 */
export type EmailTemplate =
  | { name: "verify-email"; props: VerifyEmailProps }
  | { name: "reset-password"; props: ResetPasswordProps }
  | { name: "invitation"; props: InvitationProps }
  | { name: "account-exists"; props: AccountExistsProps }
  | { name: "brief-ready"; props: BriefReadyProps };

export type RenderedEmail = { subject: string; html: string; text: string };

/** `text` is the hand-written plain-text part; a template without one gets the text scraped from its HTML. */
type Parts = { subject: string; element: ReactElement; text?: string };

function parts(template: EmailTemplate): Parts {
  switch (template.name) {
    case "verify-email":
      return { subject: verifyEmailSubject, element: <VerifyEmail {...template.props} />, text: verifyEmailText(template.props) };
    case "reset-password":
      return { subject: resetPasswordSubject, element: <ResetPassword {...template.props} />, text: resetPasswordText(template.props) };
    case "invitation":
      return { subject: invitationSubject(template.props), element: <Invitation {...template.props} />, text: invitationText(template.props) };
    case "account-exists":
      return { subject: accountExistsSubject, element: <AccountExists {...template.props} />, text: accountExistsText(template.props) };
    case "brief-ready":
      return { subject: briefReadySubject(template.props), element: <BriefReady {...template.props} /> };
  }
}

export async function renderEmail(template: EmailTemplate): Promise<RenderedEmail> {
  const { subject, element, text } = parts(template);
  const [html, plain] = await Promise.all([render(element), text ?? render(element, { plainText: true })]);
  return { subject, html, text: plain };
}
