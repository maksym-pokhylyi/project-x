"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Same-origin, so no baseURL is needed.
 * Use it for sign-in/up/out, password flows and workspace membership actions;
 * everything else goes through Server Actions.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
