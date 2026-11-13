import { render } from "@react-email/render";
import { AccountExists, accountExistsSubject, type AccountExistsProps } from "@/emails/account-exists";
import { Invitation, invitationSubject, type InvitationProps } from "@/emails/invitation";
import { ResetPassword, resetPasswordSubject, type ResetPasswordProps } from "@/emails/reset-password";
import { VerifyEmail, verifyEmailSubject, type VerifyEmailProps } from "@/emails/verify-email";

/**
 * All transactional e-mails the app can send. To add one: create the React Email
 * component in src/emails, add a variant here and a case in renderEmail().
 */
export type EmailTemplate =
  | { name: "verify-email"; props: VerifyEmailProps }
  | { name: "reset-password"; props: ResetPasswordProps }
  | { name: "invitation"; props: InvitationProps }
  | { name: "account-exists"; props: AccountExistsProps };

export type RenderedEmail = { subject: string; html: string; text: string };

export async function renderEmail(template: EmailTemplate): Promise<RenderedEmail> {
  const { subject, element } = (() => {
    switch (template.name) {
      case "verify-email":
        return { subject: verifyEmailSubject, element: <VerifyEmail {...template.props} /> };
      case "reset-password":
        return { subject: resetPasswordSubject, element: <ResetPassword {...template.props} /> };
      case "invitation":
        return { subject: invitationSubject(template.props), element: <Invitation {...template.props} /> };
      case "account-exists":
        return { subject: accountExistsSubject, element: <AccountExists {...template.props} /> };
    }
  })();
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, html, text };
}
