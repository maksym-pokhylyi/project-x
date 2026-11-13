import { vi } from "vitest";

/** A UK representative that exists only in tests. */
export const TEST_REPRESENTATIVE = "Example Rep Ltd, 2 Sample Road, London EX1 2MP";

/**
 * The module "@/config/site" with a UK representative appointed, or with the null it
 * holds before one is. Whether named addresses may be listed depends on it, so the outreach
 * suites pin the state they test instead of reading whatever site.ts says on the day:
 *
 *   vi.mock("@/config/site", async () => (await import("./mocks/site")).siteModule(true));
 */
export async function siteModule(representativeAppointed: boolean) {
  const actual = await vi.importActual<typeof import("@/config/site")>("@/config/site");
  const ukRepresentative = representativeAppointed ? TEST_REPRESENTATIVE : null;
  return { ...actual, site: { ...actual.site, operator: { ...actual.site.operator, ukRepresentative } } };
}
