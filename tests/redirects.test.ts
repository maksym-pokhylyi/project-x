import { describe, expect, it } from "vitest";
import { safeRedirect } from "@/lib/redirects";

/**
 * F-07 — open redirect on /sign-in and /sign-up for signed-in users.
 * `safeRedirect` must return a path that a browser resolves on THIS site, whatever it is given.
 */
describe("safeRedirect (F-07)", () => {
  /** Where a browser would end up when sent to `location` from the app. */
  const landsOn = (location: string) => new URL(location, "https://bidfolio.co.uk/sign-in").origin;

  it("keeps ordinary same-site targets, including query and fragment", () => {
    expect(safeRedirect("/app")).toBe("/app");
    expect(safeRedirect("/app/settings/billing?plan=pro&interval=year")).toBe("/app/settings/billing?plan=pro&interval=year");
    expect(safeRedirect("/accept-invitation/abc123#top")).toBe("/accept-invitation/abc123#top");
    expect(safeRedirect("/app/bids?q=a%20b")).toBe("/app/bids?q=a%20b");
    expect(safeRedirect("/")).toBe("/");
  });

  it("falls back for empty, relative and absolute targets", () => {
    for (const target of [null, undefined, "", "app", "./app", "https://evil.example", "//evil.example", "http:/evil.example", "javascript:alert(1)", "mailto:a@b.c"]) {
      expect(safeRedirect(target), String(target)).toBe("/app");
    }
    expect(safeRedirect("https://evil.example", "/home")).toBe("/home");
  });

  it("rejects the tab trick from the review (/%09/evil.example) and its relatives", () => {
    const attacks = [
      "/\t/evil.example/phish", // browsers strip the tab -> //evil.example/phish
      "/\n/evil.example",
      "/\r/evil.example",
      "/\r\n/evil.example",
      "\t//evil.example",
      "/\\evil.example", // browsers treat "\" as "/"
      "/\\/evil.example",
      "\\/evil.example",
      "/\u0000/evil.example",
      "/\u000b/evil.example",
      "/\u001f/evil.example",
      "/\u007f/evil.example",
      "/.//evil.example", // dot segments collapse to //evil.example
      "/..//evil.example",
      "/app/..//evil.example",
      "/./\\evil.example",
      "//evil.example/%2F..",
      "///evil.example",
      "/https://evil.example/../..//evil.example",
    ];
    for (const attack of attacks) {
      const result = safeRedirect(attack);
      expect(landsOn(result), JSON.stringify(attack)).toBe("https://bidfolio.co.uk");
      expect(result.startsWith("//"), JSON.stringify(attack)).toBe(false);
    }
    expect(safeRedirect("/\t/evil.example/phish")).toBe("/app");
    expect(safeRedirect("/.//evil.example")).toBe("/app");
  });

  it("whatever it returns is a single-slash path on this site", () => {
    const inputs = ["/%09/evil.example", "/%2F%2Fevil.example", "/%5Cevil.example", "/app?next=//evil.example", "/app#//evil.example", "/@evil.example", "/:evil.example", "/x".repeat(2000)];
    for (const input of inputs) {
      const result = safeRedirect(input);
      expect(result.startsWith("/") && !result.startsWith("//"), input.slice(0, 40)).toBe(true);
      expect(landsOn(result), input.slice(0, 40)).toBe("https://bidfolio.co.uk");
      expect(/[\u0000-\u001f\\]/.test(result), input.slice(0, 40)).toBe(false);
    }
  });
});
