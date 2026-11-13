"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { acceptInvitationAction } from "@/server/actions/members";

export function AcceptInvitationButton({ invitationId, organizationName }: { invitationId: string; organizationName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await acceptInvitationAction(invitationId);
        if (!result.ok) {
          setPending(false);
          toast.error(result.error.message);
          return;
        }
        toast.success(`You joined ${organizationName}.`);
        router.push("/app");
        router.refresh();
      }}
    >
      {pending ? "Joining…" : `Join ${organizationName}`}
    </Button>
  );
}

export function SignOutButton({ redirectTo, label = "Sign out" }: { redirectTo: string; label?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={async () => {
        await authClient.signOut();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
