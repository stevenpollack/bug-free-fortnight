import type pino from "pino";
import { logger as rootLogger } from "../logger";

const ALLOWED_ORIGIN = "https://www.recipetineats.com";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;
const USER_AGENT = "family-recipes/0.1 (+self-hosted)";

/** Minimal fetcher interface used for DI in tests. */
export type Fetcher = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SafeFetchErrorCode =
  | "DISALLOWED_URL"
  | "CROSS_ORIGIN_REDIRECT"
  | "SIZE_EXCEEDED"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS";

export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "https:" || url.origin !== ALLOWED_ORIGIN) {
    throw new SafeFetchError(
      "DISALLOWED_URL",
      `URL not allowed: only ${ALLOWED_ORIGIN} URLs are permitted`,
    );
  }
}

/**
 * Fetch a URL with safety constraints:
 * - Origin allowlist (https://www.recipetineats.com only)
 * - 10 s timeout
 * - 2 MB response body cap
 * - Manual redirect handling; cross-origin redirects are rejected
 * - Max 3 redirects
 */
export async function safeFetch(
  urlStr: string,
  fetcher: Fetcher = fetch,
  log: pino.Logger = rootLogger,
): Promise<Response> {
  const parsedUrl = new URL(urlStr);

  try {
    assertAllowedUrl(parsedUrl);
  } catch (err) {
    if (err instanceof SafeFetchError) {
      log.warn({ code: err.code, url: urlStr }, "safeFetch rejected");
    }
    throw err;
  }

  log.info({ url: urlStr }, "safeFetch start");

  let currentUrl = urlStr;
  let redirectCount = 0;

  while (true) {
    const signal = AbortSignal.timeout(10_000);

    let response: Response;
    try {
      response = await fetcher(currentUrl, {
        redirect: "manual",
        signal,
        headers: { "User-Agent": USER_AGENT },
      });
    } catch (err) {
      log.warn({ url: currentUrl, redirectCount }, "safeFetch network error");
      throw err;
    }

    // Follow same-origin redirects only
    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        log.warn({ code: "TOO_MANY_REDIRECTS", url: currentUrl, redirectCount }, "safeFetch rejected");
        throw new SafeFetchError("TOO_MANY_REDIRECTS", `Exceeded ${MAX_REDIRECTS} redirects`);
      }

      const location = response.headers.get("Location");
      if (!location) {
        log.warn({ code: "CROSS_ORIGIN_REDIRECT", url: currentUrl }, "safeFetch rejected");
        throw new SafeFetchError("CROSS_ORIGIN_REDIRECT", "Redirect with no Location header");
      }

      const redirectUrl = new URL(location, currentUrl);
      if (redirectUrl.origin !== parsedUrl.origin) {
        log.warn(
          { code: "CROSS_ORIGIN_REDIRECT", url: currentUrl, redirectTo: redirectUrl.origin },
          "safeFetch rejected",
        );
        throw new SafeFetchError(
          "CROSS_ORIGIN_REDIRECT",
          `Cross-origin redirect to ${redirectUrl.origin} rejected`,
        );
      }

      log.debug({ from: currentUrl, to: redirectUrl.toString(), redirectCount }, "safeFetch redirect");
      currentUrl = redirectUrl.toString();
      redirectCount++;
      continue;
    }

    // Read body with size cap
    if (!response.body) {
      log.info({ url: currentUrl, status: response.status, bytes: 0 }, "safeFetch success");
      return new Response("", {
        status: response.status,
        headers: response.headers,
      });
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BYTES) {
        await reader.cancel();
        log.warn({ code: "SIZE_EXCEEDED", url: currentUrl }, "safeFetch rejected");
        throw new SafeFetchError(
          "SIZE_EXCEEDED",
          `Response exceeds ${MAX_BYTES / 1024 / 1024} MB limit`,
        );
      }
      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    log.info({ url: currentUrl, status: response.status, bytes: totalBytes }, "safeFetch success");
    return new Response(body, { status: response.status, headers: response.headers });
  }
}
