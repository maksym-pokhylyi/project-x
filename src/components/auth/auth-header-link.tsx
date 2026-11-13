"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * The one link in the header of the sign-in and sign-up pages, as in the artboards: on
 * "Sign in" it offers "Create an account", everywhere else "Sign in". It carries the
 * destination (and a prefilled email) along, so switching pages never loses where the
 * person was going.
 */
export function AuthHeaderLink() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onSignIn = pathname === "/sign-in";

  const carried = new URLSearchParams();
  const redirect = params.get("redirect") ?? params.get("next");
  if (redirect) carried.set("redirect", redirect);
  const email = params.get("email");
  if (email) carried.set("email", email);
  const query = carried.toString();

  return (
    <Link
      href={`${onSignIn ? "/sign-up" : "/sign-in"}${query ? `?${query}` : ""}`}
      className="link inline-flex min-h-11 items-center rounded-sm text-sm font-medium md:link-quiet md:text-15 md:no-underline"
    >
      {onSignIn ? "Create an account" : "Sign in"}
    </Link>
  );
}
