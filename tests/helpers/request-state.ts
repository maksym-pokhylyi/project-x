/**
 * Mutable holder for the request headers that the `next/headers` test double returns.
 *
 * Kept on `globalThis` so that tests which reload the app with `vi.resetModules()` (to run
 * it under a different environment) still share ONE state between `actAs()` and the
 * reloaded modules.
 */
const holder = globalThis as unknown as { __testRequestState?: { headers: Headers } };

export const requestState: { headers: Headers } = (holder.__testRequestState ??= { headers: new Headers() });
