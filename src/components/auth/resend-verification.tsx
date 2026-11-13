"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ResendVerification({ email, callbackURL }: { email: string; callbackURL: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.sendVerificationEmail({ email, callbackURL });
        setPending(false);
        if (error) toast.error(error.message ?? "Could not send the e-mail. Please try again.");
        else toast.success("Verification e-mail sent.");
      }}
    >
      {pending ? "Sending…" : "Resend verification e-mail"}
    </Button>
  );
}
