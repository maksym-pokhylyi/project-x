/**
 * Test doubles for `next/navigation` and `next/cache`, for suites that call Server Actions,
 * Route Handlers or page functions directly:
 *
 *   vi.mock("next/navigation", async () => (await import("./mocks/next")).navigation);
 *   vi.mock("next/cache", async () => (await import("./mocks/next")).cache);
 *
 * redirect(), forbidden() and notFound() end a request by throwing; here they throw plain
 * errors a test can read ("REDIRECT:/path", "FORBIDDEN", "NOT_FOUND").
 */
const CONTROL = /^(REDIRECT:|FORBIDDEN$|NOT_FOUND$)/;

export const navigation = {
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  forbidden: (): never => {
    throw new Error("FORBIDDEN");
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
  /** As in Next.js: lets the control-flow errors above pass through a catch block. */
  unstable_rethrow: (error: unknown): void => {
    if (error instanceof Error && CONTROL.test(error.message)) throw error;
  },
  // Client hooks, for pages rendered to static markup: a router that goes nowhere.
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, forward: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
};

/** Tags and paths a test run asked to revalidate, newest last. */
export const revalidated: string[] = [];

export const cache = {
  revalidatePath: (path: string): void => {
    revalidated.push(`path:${path}`);
  },
  revalidateTag: (tag: string): void => {
    revalidated.push(`tag:${tag}`);
  },
  unstable_cache: <T>(fn: T): T => fn,
};
