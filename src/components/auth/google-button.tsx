"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleButton({ callbackURL, label = "Continue with Google" }: { callbackURL: string; label?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({ provider: "google", callbackURL });
        if (error) {
          toast.error(error.message ?? "Google sign-in failed. Please try again.");
          setPending(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-13 text-ink-2" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
