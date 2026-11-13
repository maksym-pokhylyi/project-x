import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { AccountExists, accountExistsSubject, accountExistsText, type AccountExistsProps } from "@/emails/account-exists";
import { BriefReady, briefReadySubject, type BriefReadyProps } from "@/emails/brief-ready";
import { Invitation, invitationSubject, invitationText, type InvitationProps } from "@/emails/invitation";
import { ResetPassword, resetPasswordSubject, resetPasswordText, type ResetPasswordProps } from "@/emails/reset-password";
import { VerifyEmail, verifyEmailSubject, verifyEmailText, type VerifyEmailProps } from "@/emails/verify-email";
import { radarEmail, type RadarEmailProps } from "@/features/notifications/emails/radar-email";
import { reminderEmail, type ReminderEmailProps } from "@/features/notifications/emails/reminder-email";
import { renewalEmail, type RenewalEmailProps } from "@/features/notifications/emails/renewal-email";

/**
 * All e-mails the app can send. To add one: create the React Email component in src/emails
 * (inside <EmailLayout>, with a plain-text function built on emailText() from
 * src/emails/text.ts), add a variant here and a case in parts().
 *
 * The scheduled e-mails (weekly digest, daily alert, deadline and renewal reminders) live in
 * src/features/notifications/emails and bring their own plain-text version too. A template
 * without one gets the text scraped from its HTML.
 */
export type EmailTemplate =
  | { name: "verify-email"; props: VerifyEmailProps }
  | { name: "reset-password"; props: ResetPasswordProps }
  | { name: "invitation"; props: InvitationProps }
  | { name: "account-exists"; props: AccountExistsProps }
  | { name: "brief-ready"; props: BriefReadyProps }
  | { name: "radar-digest"; props: RadarEmailProps }
  | { name: "radar-alert"; props: RadarEmailProps }
  | { name: "deadline-reminder"; props: ReminderEmailProps }
  | { name: "renewal-reminder"; props: RenewalEmailProps };

export type RenderedEmail = { subject: string; html: string; text: string };

/** `text` is the hand-written plain-text part. */
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
    case "radar-digest":
    case "radar-alert":
      return radarEmail(template.props);
    case "deadline-reminder":
      return reminderEmail(template.props);
    case "renewal-reminder":
      return renewalEmail(template.props);
  }
}

export async function renderEmail(template: EmailTemplate): Promise<RenderedEmail> {
  const { subject, element, text } = parts(template);
  const [html, plain] = await Promise.all([render(element), text ?? render(element, { plainText: true })]);
  return { subject, html, text: plain };
}
