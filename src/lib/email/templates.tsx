import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { AccountExists, accountExistsSubject, type AccountExistsProps } from "@/emails/account-exists";
import { BriefReady, briefReadySubject, type BriefReadyProps } from "@/emails/brief-ready";
import { Invitation, invitationSubject, type InvitationProps } from "@/emails/invitation";
import { ResetPassword, resetPasswordSubject, type ResetPasswordProps } from "@/emails/reset-password";
import { VerifyEmail, verifyEmailSubject, type VerifyEmailProps } from "@/emails/verify-email";
import { radarEmail, type RadarEmailProps } from "@/features/notifications/emails/radar-email";
import { reminderEmail, type ReminderEmailProps } from "@/features/notifications/emails/reminder-email";
import { renewalEmail, type RenewalEmailProps } from "@/features/notifications/emails/renewal-email";

/**
 * All transactional e-mails the app can send. To add one: create the React Email
 * component in src/emails, add a variant here and a case in renderEmail().
 *
 * The scheduled e-mails (weekly digest, daily alert, deadline and renewal reminders) live in
 * src/features/notifications/emails and bring their own plain-text version (`text`); for
 * the others the text part is derived from the HTML.
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

export async function renderEmail(template: EmailTemplate): Promise<RenderedEmail> {
  const { subject, element, text: ownText } = ((): { subject: string; element: ReactElement; text?: string } => {
    switch (template.name) {
      case "verify-email":
        return { subject: verifyEmailSubject, element: <VerifyEmail {...template.props} /> };
      case "reset-password":
        return { subject: resetPasswordSubject, element: <ResetPassword {...template.props} /> };
      case "invitation":
        return { subject: invitationSubject(template.props), element: <Invitation {...template.props} /> };
      case "account-exists":
        return { subject: accountExistsSubject, element: <AccountExists {...template.props} /> };
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
  })();
  const [html, text] = await Promise.all([render(element), ownText ?? render(element, { plainText: true })]);
  return { subject, html, text };
}
