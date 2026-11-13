"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * "Sign in" for visitors, "Open your radar" for people who are already signed in.
 * The header itself stays static (cacheable): this island asks for the session after the
 * page has loaded and swaps the label without moving anything else.
 */
export function HeaderSessionLink({ className }: { className?: string }) {
  const { data } = authClient.useSession();
  const signedIn = Boolean(data?.user);
  return (
    <Link href={signedIn ? "/app" : "/sign-in"} className={cn(className)}>
      {signedIn ? "Open your radar" : "Sign in"}
    </Link>
  );
}
