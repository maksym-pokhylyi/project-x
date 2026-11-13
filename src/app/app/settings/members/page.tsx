import type { Metadata } from "next";
import Link from "next/link";
import { InvitationsList, InviteForm, MembersList } from "@/components/app/members-manager";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSeatUsage, listMembers, listPendingInvitations } from "@/server/members";
import { requireOrgForPage } from "@/server/session";
import { hasRole } from "@/server/workspaces";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const ctx = await requireOrgForPage();
  const canManage = hasRole(ctx.role, "admin");
  const [members, seats, invitations] = await Promise.all([
    listMembers(ctx),
    getSeatUsage(ctx),
    canManage ? listPendingInvitations(ctx) : Promise.resolve([]),
  ]);
  const used = seats.members + seats.pendingInvitations;
  const seatsAvailable = seats.limit === null || used < seats.limit;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description={
          <span data-testid="seat-usage">
            {seats.limit === null ? `${used} seats in use` : `${used} of ${seats.limit} seats in use`} on the {ctx.plan.name} plan.
            {ctx.role === "owner" && !seatsAvailable ? (
              <>
                {" "}
                <Link href="/app/settings/billing" className="link font-medium">
                  Upgrade for more seats
                </Link>
              </>
            ) : null}
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>They will receive an e-mail with a link to join this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm seatsAvailable={seatsAvailable} canInvite={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Owners manage billing; owners and admins manage members and settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <MembersList
            members={members.map((member) => ({ id: member.id, userId: member.userId, name: member.name, email: member.email, role: member.role }))}
            currentUserId={ctx.user.id}
            currentRole={ctx.role}
          />
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Invitations count towards your seats until they are accepted or cancelled.</CardDescription>
          </CardHeader>
          <CardContent>
            <InvitationsList
              invitations={invitations.map((invitation) => ({
                id: invitation.id,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
