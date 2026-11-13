"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, FormRow, FormRowAction } from "@/components/forms/form-field";
import { NativeSelect } from "@/components/forms/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fieldErrorsFrom, inviteSchema, type FieldErrors } from "@/lib/validation";
import {
  cancelInvitationAction,
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/server/actions/members";

export type MemberItem = { id: string; userId: string; name: string; email: string; role: "owner" | "admin" | "member" };
export type InvitationItem = { id: string; email: string; role: string; expiresAt: string };

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" } as const;

export function InviteForm({ seatsAvailable, canInvite }: { seatsAvailable: boolean; canInvite: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = inviteSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await inviteMemberAction(parsed.data);
    setPending(false);
    if (!result.ok) {
      setErrors((result.error.details?.fieldErrors as FieldErrors | undefined) ?? {});
      setFormError(result.error.message);
      return;
    }
    form.reset();
    toast.success(`Invitation sent to ${parsed.data.email}.`);
    router.refresh();
  }

  if (!canInvite) {
    return <p className="text-sm text-ink-2">Only owners and admins can invite members.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3" data-testid="invite-form">
      <FormError message={formError} />
      <FormRow>
        <div className="flex-1">
          <FormField label="E-mail address" name="email" type="email" placeholder="colleague@company.com" required error={errors.email?.[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <NativeSelect id="invite-role" name="role" defaultValue="member" className="w-full sm:w-32">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </NativeSelect>
        </div>
        <FormRowAction>
          <Button type="submit" disabled={!seatsAvailable} loading={pending}>
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </FormRowAction>
      </FormRow>
      {!seatsAvailable ? (
        <p role="status" className="text-sm text-ink-2">
          All seats of your plan are in use. Upgrade the plan or remove a member to invite someone new.
        </p>
      ) : null}
    </form>
  );
}

export function MembersList({
  members,
  currentUserId,
  currentRole,
}: {
  members: MemberItem[];
  currentUserId: string;
  currentRole: "owner" | "admin" | "member";
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<MemberItem | null>(null);
  const canManage = currentRole !== "member";

  async function changeRole(member: MemberItem, role: string) {
    setBusyId(member.id);
    const result = await updateMemberRoleAction({ memberId: member.id, role });
    setBusyId(null);
    if (!result.ok) toast.error(result.error.message);
    else toast.success(`${member.name} is now ${ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}.`);
    router.refresh();
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setBusyId(toRemove.id);
    const result = await removeMemberAction(toRemove.id);
    setBusyId(null);
    if (!result.ok) toast.error(result.error.message);
    else toast.success(`${toRemove.name} was removed.`);
    setToRemove(null);
    router.refresh();
  }

  return (
    <>
      <ul className="divide-y divide-line" data-testid="members-list">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          // Admins manage members and admins; only owners can touch owners.
          const editable = canManage && !isSelf && (currentRole === "owner" || member.role !== "owner");
          return (
            <li key={member.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" data-testid="member-row">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {member.name} {isSelf ? <span className="font-normal text-ink-2">(you)</span> : null}
                </p>
                <p className="truncate text-sm text-ink-2">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {editable ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Role of {member.name}
                    </label>
                    <NativeSelect
                      id={`role-${member.id}`}
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(event) => void changeRole(member, event.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      {currentRole === "owner" ? <option value="owner">Owner</option> : null}
                    </NativeSelect>
                    <Button variant="outline" disabled={busyId === member.id} onClick={() => setToRemove(member)}>
                      Remove
                    </Button>
                  </>
                ) : (
                  <Badge variant="secondary" data-testid="member-role">
                    {ROLE_LABEL[member.role]}
                  </Badge>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={toRemove !== null} onOpenChange={(open) => (open ? undefined : setToRemove(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {toRemove?.name}?</DialogTitle>
            <DialogDescription>
              They will immediately lose access to this workspace. You can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busyId !== null} onClick={() => void confirmRemove()}>
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvitationsList({ invitations }: { invitations: InvitationItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function copyLink(invitation: InvitationItem) {
    const link = `${window.location.origin}/accept-invitation/${invitation.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invitation link copied.");
    } catch {
      toast.message("Copy this invitation link", { description: link });
    }
  }

  async function cancel(invitation: InvitationItem) {
    setBusyId(invitation.id);
    const result = await cancelInvitationAction(invitation.id);
    setBusyId(null);
    if (!result.ok) toast.error(result.error.message);
    else toast.success(`Invitation for ${invitation.email} cancelled.`);
    router.refresh();
  }

  if (invitations.length === 0) {
    return <p className="text-sm text-ink-2">No pending invitations.</p>;
  }

  return (
    <ul className="divide-y divide-line" data-testid="invitations-list">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{invitation.email}</p>
            <p className="text-sm text-ink-2">
              {ROLE_LABEL[invitation.role as keyof typeof ROLE_LABEL] ?? invitation.role} · expires{" "}
              {new Date(invitation.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void copyLink(invitation)}>
              Copy link
            </Button>
            <Button variant="outline" disabled={busyId === invitation.id} onClick={() => void cancel(invitation)}>
              Cancel
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
