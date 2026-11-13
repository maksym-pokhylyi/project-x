import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Fetching a user-supplied URL without letting it reach anything private (SSRF).
 *
 *  - only http/https, default ports, no credentials in the URL;
 *  - the host must resolve ONLY to public addresses (no loopback, RFC 1918, link-local,
 *    CGNAT, multicast, documentation or IPv6 local ranges; IPv4-mapped IPv6 is unwrapped);
 *  - the connection is PINNED to the address that was checked, so a second DNS answer
 *    (DNS rebinding) cannot redirect it to a private address;
 *  - redirects are followed by hand, each hop validated the same way, at most three;
 *  - hard limits on time and body size; only text responses are accepted.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export class FetchFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchFailedError";
  }
}

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** True only for addresses on the public internet. */
export function isPublicAddress(address: string): boolean {
  const value = address.trim().replace(/^\[|\]$/g, "");
  const family = isIP(value);
  if (family === 4) return !blocked.check(value, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
    if (mapped) return isPublicAddress(mapped[1]!);
    const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(value);
    if (mappedHex) {
      const high = parseInt(mappedHex[1]!, 16);
      const low = parseInt(mappedHex[2]!, 16);
      return isPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return !blocked.check(value, "ipv6");
  }
  return false;
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".test", ".invalid", ".example", ".onion"];

/** Parses and statically validates a URL. Throws UnsafeUrlError with a user-facing message. */
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  const trimmed = raw.trim();
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UnsafeUrlError("Enter a valid website address, for example https://www.yourcompany.co.uk");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http and https addresses can be read.");
  if (url.username || url.password) throw new UnsafeUrlError("The address must not contain a username or password.");
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new UnsafeUrlError("Only standard web ports can be read.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) throw new UnsafeUrlError("Enter a valid website address.");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new UnsafeUrlError("That address is not a public website.");
    return url;
  }
  if (host === "localhost" || !host.includes(".") || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UnsafeUrlError("That address is not a public website.");
  }
  return url;
}

export type ResolveHost = (host: string) => Promise<string[]>;

const defaultResolve: ResolveHost = async (host) => {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

export type TransportRequest = { url: URL; address: string | null; signal: AbortSignal; maxBytes: number; headers: Record<string, string> };
export type TransportResponse = { status: number; headers: Record<string, string>; body: Uint8Array; truncated: boolean };
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/** Real transport: node http(s) with the socket pinned to the validated address. */
const pinnedTransport: Transport = ({ url, address, signal, maxBytes, headers }) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const family = address ? isIP(address) : 0;
    const request = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
        signal,
        agent: false,
        ...(url.protocol === "https:" ? { servername: url.hostname } : {}),
        // Connect to the address we validated, whatever DNS says now.
        ...(address && family
          ? {
              lookup: (_host: string, options: unknown, callback: (...args: unknown[]) => void) => {
                const wantsAll = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
                if (wantsAll) callback(null, [{ address, family }]);
                else callback(null, address, family);
              },
            }
          : {}),
      } as http.RequestOptions,
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        response.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
            response.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        const finish = () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers)) {
            if (typeof value === "string") responseHeaders[key.toLowerCase()] = value;
            else if (Array.isArray(value)) responseHeaders[key.toLowerCase()] = value.join(", ");
          }
          resolve({ status: response.statusCode ?? 0, headers: responseHeaders, body: new Uint8Array(Buffer.concat(chunks)), truncated });
        };
        response.on("end", finish);
        response.on("error", (error) => (truncated ? undefined : reject(error)));
      },
    );
    request.on("error", reject);
    request.end();
  });

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Test seams. */
  resolveHost?: ResolveHost;
  transport?: Transport;
};

export type SafeFetchResult = { finalUrl: string; status: number; contentType: string; text: string; truncated: boolean };

const TEXT_TYPES = /^(text\/html|text\/plain|application\/xhtml\+xml)\b/i;

/**
 * GETs a public web page as text. Throws UnsafeUrlError (blocked target) or
 * FetchFailedError (unreachable, wrong type, too slow) with messages safe to show.
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const resolveHost = options.resolveHost ?? defaultResolve;
  const transport = options.transport ?? pinnedTransport;
  const signal = AbortSignal.timeout(timeoutMs);

  let url = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    let address: string | null = null;
    if (isIP(host)) address = host;
    else {
      let addresses: string[];
      try {
        addresses = await resolveHost(host);
      } catch {
        throw new FetchFailedError("That website could not be found. Check the address.");
      }
      if (addresses.length === 0) throw new FetchFailedError("That website could not be found. Check the address.");
      // Every answer must be public: one private record is enough to refuse.
      if (!addresses.every((candidate) => isPublicAddress(candidate))) throw new UnsafeUrlError("That address is not a public website.");
      address = addresses[0]!;
    }

    let response: TransportResponse;
    try {
      response = await transport({
        url,
        address,
        signal,
        maxBytes,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; company-facts-reader/1.0)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "accept-language": "en-GB,en;q=0.8",
          "accept-encoding": "identity",
        },
      });
    } catch (error) {
      if (signal.aborted) throw new FetchFailedError("That website took too long to respond.");
      throw new FetchFailedError(`That website could not be read${error instanceof Error && /certificate|tls|ssl/i.test(error.message) ? " (certificate problem)" : ""}.`);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) throw new FetchFailedError("That website redirected without a destination.");
      if (hop === maxRedirects) throw new FetchFailedError("That website redirects too many times.");
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        throw new FetchFailedError("That website redirected to an invalid address.");
      }
      url = parsePublicUrl(next.toString()); // validates protocol, port and host of the redirect target
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchFailedError(`That website answered with an error (${response.status}).`);
    const contentType = response.headers["content-type"] ?? "";
    if (!TEXT_TYPES.test(contentType)) throw new FetchFailedError("That address is not a web page we can read.");
    const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
    let text: string;
    try {
      text = new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(response.body);
    } catch {
      text = new TextDecoder("utf-8").decode(response.body);
    }
    return { finalUrl: url.toString(), status: response.status, contentType, text, truncated: response.truncated };
  }
  throw new FetchFailedError("That website redirects too many times.");
}

/**
 * Local development behind an egress proxy (no direct DNS): a transport that uses the
 * platform fetch, with redirects still handled and validated by safeFetchText. Addresses
 * cannot be pinned through a proxy, so this is refused on a production deployment.
 */
export const proxyTransport: Transport = async ({ url, signal, maxBytes, headers }) => {
  if (process.env.VERCEL_ENV === "production") throw new Error("proxyTransport is for local development only");
  const response = await fetch(url, { redirect: "manual", signal, headers, cache: "no-store" });
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => (responseHeaders[key.toLowerCase()] = value));
  const buffer = new Uint8Array(await response.arrayBuffer());
  return { status: response.status, headers: responseHeaders, body: buffer.subarray(0, maxBytes), truncated: buffer.byteLength > maxBytes };
};
