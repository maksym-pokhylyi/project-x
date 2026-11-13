import { createHmac, hkdfSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unsubscribeLinks } from "@/features/notifications/links";
import { signUnsubscribeToken, tokenNamesAddress, verifyUnsubscribeToken } from "@/features/notifications/tokens";

/**
 * Unsubscribe tokens: the whole credential of an unsubscribe link. They must verify only
 * when we signed them, name exactly one (user, workspace, kind), and keep working for as
 * long as the e-mail exists.
 */
const SECRET = "test-secret-test-secret-test-secret-0123456789"; // vitest.config.ts
const subject = { userId: "Hokduz68Anj5JeNhcAkryRnkTjarvFwB", organizationId: "knkgj7gxNa0qeOQ9FYFVXSQt0sETgsQw", kind: "digest" } as const;
const b64 = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** The documented construction, written out independently of the implementation. */
function expectedToken(payload: string, secret = SECRET): string {
  const context = "bidfolio:notifications:unsubscribe:v1";
  const key = Buffer.from(hkdfSync("sha256", secret, "bidfolio:hkdf:v1", context, 32));
  return `${b64(payload)}.${createHmac("sha256", key).update(`${context}\n${payload}`).digest("base64url")}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("unsubscribe tokens", () => {
  it("round-trips the member, the workspace and the kind", () => {
    const token = signUnsubscribeToken(subject);
    expect(verifyUnsubscribeToken(token)).toEqual({ ...subject, addressTag: null });
    for (const kind of ["digest", "alert", "reminder", "renewal", "product"] as const) {
      expect(verifyUnsubscribeToken(signUnsubscribeToken({ ...subject, kind }))).toMatchObject({ kind });
    }
  });

  it("is HMAC-SHA256 under a key derived from BETTER_AUTH_SECRET by HKDF with a fixed label", () => {
    // Pinned on purpose: changing the derivation would break the links in every e-mail already sent.
    const payload = `${subject.userId}\n${subject.organizationId}\ndigest`;
    expect(signUnsubscribeToken(subject)).toBe(expectedToken(payload));
    expect(signUnsubscribeToken(subject)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  });

  it("does not expire and does not depend on when it is checked", () => {
    const token = signUnsubscribeToken(subject);
    expect(signUnsubscribeToken(subject)).toBe(token); // nothing time-dependent inside
    vi.useFakeTimers({ now: new Date("2031-06-01T00:00:00Z"), toFake: ["Date"] });
    expect(verifyUnsubscribeToken(token)).toMatchObject(subject);
  });

  it("rejects anything we did not sign", () => {
    const token = signUnsubscribeToken(subject);
    const [payload, signature] = token.split(".") as [string, string];
    const other = (text: string) => `${b64(text)}.${signature}`;

    // Another member, workspace or kind under the same signature.
    expect(verifyUnsubscribeToken(other(`someoneElse\n${subject.organizationId}\ndigest`))).toBeNull();
    expect(verifyUnsubscribeToken(other(`${subject.userId}\notherWorkspace\ndigest`))).toBeNull();
    expect(verifyUnsubscribeToken(other(`${subject.userId}\n${subject.organizationId}\nreminder`))).toBeNull();
    // A damaged signature (every position matters).
    for (const index of [0, 10, 42]) {
      const flipped = signature.slice(0, index) + (signature[index] === "A" ? "B" : "A") + signature.slice(index + 1);
      expect(verifyUnsubscribeToken(`${payload}.${flipped}`)).toBeNull();
    }
    expect(verifyUnsubscribeToken(`${payload}.${signature.slice(0, 42)}`)).toBeNull();
    expect(verifyUnsubscribeToken(`${payload}.`)).toBeNull();
    expect(verifyUnsubscribeToken(payload)).toBeNull();
    // Signed with another secret, or with the secret itself instead of the derived key.
    const text = `${subject.userId}\n${subject.organizationId}\ndigest`;
    expect(verifyUnsubscribeToken(expectedToken(text, "another-secret-another-secret-0123456789"))).toBeNull();
    expect(verifyUnsubscribeToken(`${b64(text)}.${createHmac("sha256", SECRET).update(text).digest("base64url")}`)).toBeNull();
    // Not a token at all.
    for (const junk of ["", "a.b", "nonsense", "....", `${token}.${token}`, "x".repeat(5000), null, undefined, 42, { t: token }, [token]]) {
      expect(verifyUnsubscribeToken(junk)).toBeNull();
    }
  });

  it("accepts one spelling of a token only, and only well-formed contents", () => {
    const token = signUnsubscribeToken(subject);
    const [payload, signature] = token.split(".") as [string, string];
    expect(verifyUnsubscribeToken(`${payload}=.${signature}`)).toBeNull();
    expect(verifyUnsubscribeToken(` ${token}`)).toBeNull();
    expect(verifyUnsubscribeToken(`${token}\n`)).toBeNull();
    // Correctly signed, but not a (user, workspace, kind): unknown kind, extra field, empty id.
    for (const text of [`${subject.userId}\n${subject.organizationId}\nnewsletter`, `${subject.userId}\n${subject.organizationId}\ndigest\ntag11chars_\nmore`, `\n${subject.organizationId}\ndigest`, `${subject.userId}\n${subject.organizationId}\ndigest\nshort`]) {
      expect(verifyUnsubscribeToken(expectedToken(text))).toBeNull();
    }
    // Ids that could not be signed are refused when issuing, not silently mangled.
    expect(() => signUnsubscribeToken({ ...subject, userId: "line\nbreak" })).toThrow();
    expect(() => signUnsubscribeToken({ ...subject, organizationId: "" })).toThrow();
    expect(() => signUnsubscribeToken({ ...subject, kind: "newsletter" as never })).toThrow();
  });

  it("carries a keyed tag of the address the e-mail went to, and nothing that reveals it", () => {
    const token = signUnsubscribeToken({ ...subject, email: "Joanne@Aldermoor-Pike.example" });
    const verified = verifyUnsubscribeToken(token)!;
    expect(verified).toMatchObject(subject);
    expect(verified.addressTag).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(tokenNamesAddress(verified, "joanne@aldermoor-pike.example")).toBe(true);
    expect(tokenNamesAddress(verified, "  JOANNE@ALDERMOOR-PIKE.EXAMPLE ")).toBe(true);
    expect(tokenNamesAddress(verified, "joanne@new-employer.example")).toBe(false);
    expect(tokenNamesAddress(verified, null)).toBe(false);
    expect(tokenNamesAddress(verifyUnsubscribeToken(signUnsubscribeToken(subject))!, "joanne@aldermoor-pike.example")).toBe(false);
    // The address itself is not in the token, in clear or as a plain hash.
    const decoded = Buffer.from(token.split(".")[0]!, "base64url").toString("utf8");
    expect(decoded.toLowerCase()).not.toContain("joanne");
    expect(decoded).not.toContain("@");
    // A tag cannot be swapped in from another token: it is covered by the signature.
    const otherTag = verifyUnsubscribeToken(signUnsubscribeToken({ ...subject, email: "someone@else.example" }))!.addressTag!;
    const forged = `${b64(`${subject.userId}\n${subject.organizationId}\ndigest\n${otherTag}`)}.${token.split(".")[1]}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });
});

describe("unsubscribe links and headers (RFC 8058)", () => {
  it("points the footer link at the page and the header at the one-click endpoint", () => {
    const links = unsubscribeLinks({ ...subject, email: "joanne@aldermoor-pike.example" });
    const token = signUnsubscribeToken({ ...subject, email: "joanne@aldermoor-pike.example" });
    expect(links.pageUrl).toBe(`http://localhost:3000/unsubscribe?t=${token}`);
    expect(links.oneClickUrl).toBe(`http://localhost:3000/api/notifications/unsubscribe?t=${token}`);
    expect(links.headers).toEqual({
      "List-Unsubscribe": `<http://localhost:3000/api/notifications/unsubscribe?t=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    // The token needs no escaping in a URL or a header, and the header is one short line.
    expect(encodeURIComponent(token)).toBe(token);
    expect(links.headers["List-Unsubscribe"]!.length).toBeLessThan(400);
    expect(verifyUnsubscribeToken(new URL(links.oneClickUrl).searchParams.get("t"))).toMatchObject(subject);
  });

  it("is a different link for every member, workspace and kind", () => {
    const tokens = new Set([
      signUnsubscribeToken(subject),
      signUnsubscribeToken({ ...subject, kind: "alert" }),
      signUnsubscribeToken({ ...subject, userId: "anotherUser" }),
      signUnsubscribeToken({ ...subject, organizationId: "anotherWorkspace" }),
      signUnsubscribeToken({ ...subject, email: "a@example.com" }),
      signUnsubscribeToken({ ...subject, email: "b@example.com" }),
    ]);
    expect(tokens.size).toBe(6);
  });
});
