import type { Instrumentation } from "next";

/**
 * Records every unhandled server error (Server Components, Route Handlers, Server
 * Actions, proxy) in `error_log` and forwards it to Sentry when configured.
 * Expected errors (AppError) never reach this hook: they are returned as typed results.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@/lib/report-error");
  const header = (name: string) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  await reportError(error, {
    requestId: header("x-vercel-id") ?? header("x-request-id") ?? null,
    route: context.routePath,
    method: request.method,
    digest,
    extra: { path: request.path.split("?")[0], routeType: context.routeType, routerKind: context.routerKind },
  });
};
