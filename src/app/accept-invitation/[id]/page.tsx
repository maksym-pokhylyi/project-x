import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { AcceptInvitationButton, SignOutButton } from "@/components/auth/accept-invitation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthColumn, AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui/button-link";
import { db } from "@/db";
import { invitations, organizations } from "@/db/schema";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false } };

async function loadInvitation(id: string) {
  if (id.length > 64) return null;
  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      organizationName: organizations.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(and(eq(invitations.id, id)));
  return row ?? null;
}

export default async function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invitation, user] = await Promise.all([loadInvitation(id), getUser()]);
  const path = `/accept-invitation/${encodeURIComponent(id)}`;
  const usable = invitation && invitation.status === "pending" && invitation.expiresAt > new Date();

  let content;
  if (!usable) {
    content = (
      <AuthCard
        title="This invitation is no longer valid"
        description="It may have expired, been cancelled or already been used. Ask the person who invited you to send a new one."
      >
        <ButtonLink href="/" className="w-full" variant="outline">
          Go to the homepage
        </ButtonLink>
      </AuthCard>
    );
  } else if (!user) {
    const query = `redirect=${encodeURIComponent(path)}&email=${encodeURIComponent(invitation.email)}`;
    content = (
      <AuthCard
        title={`Join ${invitation.organizationName}`}
        description={
          <>
            You were invited as <strong className="font-semibold text-ink">{invitation.email}</strong>. Create an account or sign in
            with that address to accept.
          </>
        }
      >
        <div className="space-y-2">
          <ButtonLink href={`/sign-up?${query}`} className="w-full">
            Create account
          </ButtonLink>
          <ButtonLink href={`/sign-in?${query}`} className="w-full" variant="outline">
            I already have an account
          </ButtonLink>
        </div>
      </AuthCard>
    );
  } else if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    content = (
      <AuthCard
        title="Wrong account"
        description={
          <>
            This invitation was sent to <strong className="font-semibold text-ink">{invitation.email}</strong>, but you are signed
            in as <strong className="font-semibold text-ink">{user.email}</strong>.
          </>
        }
      >
        <SignOutButton redirectTo={path} label="Sign out and switch account" />
      </AuthCard>
    );
  } else {
    content = (
      <AuthCard
        title={`Join ${invitation.organizationName}`}
        description={
          <>
            You have been invited to join as <strong className="font-semibold text-ink">{invitation.role ?? "member"}</strong>.
          </>
        }
      >
        <AcceptInvitationButton invitationId={invitation.id} organizationName={invitation.organizationName} />
      </AuthCard>
    );
  }

  return (
    <AuthShell>
      <AuthColumn>{content}</AuthColumn>
    </AuthShell>
  );
}
