import { searchSuppliers } from "@/features/procurement/queries/suppliers";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { json, route } from "@/server/http";
import { getUser } from "@/server/session";

/**
 * Type-ahead for "Find your company". Public and rate-limited per address.
 * `?scope=all` (signed-in users only) also returns suppliers without a public page, so a
 * user can find and claim their own company inside the app.
 * Returns company-level fields only.
 */
export const dynamic = "force-dynamic";

export const GET = route(async (request, _context, { requestId }) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").slice(0, 120);
  const limit = await rateLimit(`procurement-search:${clientIp(request.headers)}`, { limit: 60, windowSeconds: 60 });
  if (!limit.ok) return json({ error: "Too many searches. Please wait a moment." }, { status: 429, headers: rateLimitHeaders(limit), requestId });

  const includeUnpublished = url.searchParams.get("scope") === "all" && Boolean(await getUser());
  const hits = query.trim().length >= 2 ? await searchSuppliers(query, { limit: 20, includeUnpublished }) : [];
  return json(
    {
      results: hits.map((hit) => ({ slug: hit.slug, name: hit.name, companyNumber: hit.companyNumber, locality: hit.locality, awardsCount: hit.awardsCount, isPublic: hit.isPublic })),
    },
    { requestId },
  );
});
