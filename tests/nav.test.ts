import { describe, expect, it } from "vitest";
import { isCurrentPath } from "@/lib/nav";

describe("isCurrentPath", () => {
  it("prefix: the path itself and anything below it", () => {
    expect(isCurrentPath("/app/bids", "/app/bids")).toBe(true);
    expect(isCurrentPath("/app/bids/123/questions", "/app/bids")).toBe(true);
    expect(isCurrentPath("/app/bidsy", "/app/bids")).toBe(false);
    expect(isCurrentPath("/app/library", "/app/bids")).toBe(false);
  });

  it("exact: a parent is not current on its children", () => {
    expect(isCurrentPath("/admin", "/admin", "exact")).toBe(true);
    expect(isCurrentPath("/admin/organizations", "/admin", "exact")).toBe(false);
    expect(isCurrentPath("/admin/organizations", "/admin/organizations")).toBe(true);
  });

  it("the home page is only current on itself", () => {
    expect(isCurrentPath("/", "/")).toBe(true);
    expect(isCurrentPath("/pricing", "/")).toBe(false);
  });

  it("ignores query strings and trailing slashes; anchors are never current", () => {
    expect(isCurrentPath("/pricing/", "/pricing")).toBe(true);
    expect(isCurrentPath("/app/settings/billing", "/app/settings/billing?plan=pro")).toBe(true);
    expect(isCurrentPath("/", "/#how-it-works")).toBe(false);
    expect(isCurrentPath("/pricing", "https://example.com/pricing")).toBe(false);
  });

  it("accepts a custom rule for sections that span several paths", () => {
    const radar = (path: string) => path === "/app" || path.startsWith("/app/tenders");
    expect(isCurrentPath("/app/tenders/1", "/app", radar)).toBe(true);
    expect(isCurrentPath("/app/bids", "/app", radar)).toBe(false);
  });
});
