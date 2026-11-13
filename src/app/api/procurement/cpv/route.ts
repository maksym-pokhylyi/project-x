import { searchTrades } from "@/features/procurement/queries/cpv";
import { json, route } from "@/server/http";
import { requireUser } from "@/server/session";

/** Trade picker suggestions for the manual radar profile. Signed-in users only. */
export const dynamic = "force-dynamic";

export const GET = route(async (request, _context, { requestId }) => {
  await requireUser();
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  return json({ results: await searchTrades(query, 30) }, { requestId });
});
