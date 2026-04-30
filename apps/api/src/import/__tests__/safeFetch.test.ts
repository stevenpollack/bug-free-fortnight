import { describe, expect, test } from "bun:test";
import { type Fetcher, SafeFetchError, safeFetch } from "../safeFetch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALLOWED_URL = "https://www.recipetineats.com/french-toast/";

function makeOkFetcher(body = "ok"): Fetcher {
  return () => Promise.resolve(new Response(body, { status: 200 }));
}

function makeStreamFetcher(bytes: Uint8Array): Fetcher {
  return () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const half = Math.floor(bytes.length / 2);
        controller.enqueue(bytes.slice(0, half));
        controller.enqueue(bytes.slice(half));
        controller.close();
      },
    });
    return Promise.resolve(new Response(stream, { status: 200 }));
  };
}

// ---------------------------------------------------------------------------
// URL allowlist
// ---------------------------------------------------------------------------

describe("URL allowlist", () => {
  test("rejects http URL", async () => {
    await expect(safeFetch("http://www.recipetineats.com/recipe/")).rejects.toMatchObject({
      code: "DISALLOWED_URL",
    });
  });

  test("rejects different https origin", async () => {
    await expect(safeFetch("https://www.example.com/recipe/")).rejects.toMatchObject({
      code: "DISALLOWED_URL",
    });
  });

  test("accepts allowed origin", async () => {
    const res = await safeFetch(ALLOWED_URL, makeOkFetcher());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Cross-origin redirect
// ---------------------------------------------------------------------------

describe("cross-origin redirect", () => {
  test("rejects cross-origin Location header", async () => {
    const redirectFetcher: Fetcher = () =>
      Promise.resolve(
        new Response(null, {
          status: 301,
          headers: { Location: "https://evil.com/steal" },
        }),
      );
    await expect(safeFetch(ALLOWED_URL, redirectFetcher)).rejects.toMatchObject({
      code: "CROSS_ORIGIN_REDIRECT",
    });
  });

  test("follows same-origin redirect", async () => {
    let call = 0;
    const redirectThenOk: Fetcher = () => {
      call++;
      if (call === 1) {
        return Promise.resolve(
          new Response(null, {
            status: 301,
            headers: { Location: "https://www.recipetineats.com/french-toast/#recipe" },
          }),
        );
      }
      return Promise.resolve(new Response("final", { status: 200 }));
    };

    const res = await safeFetch(ALLOWED_URL, redirectThenOk);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("final");
  });
});

// ---------------------------------------------------------------------------
// Response size cap
// ---------------------------------------------------------------------------

describe("size cap", () => {
  test("rejects body exceeding 2 MB", async () => {
    const bigBody = new Uint8Array(2 * 1024 * 1024 + 1);
    await expect(safeFetch(ALLOWED_URL, makeStreamFetcher(bigBody))).rejects.toMatchObject({
      code: "SIZE_EXCEEDED",
    });
  });

  test("accepts body at exactly 2 MB", async () => {
    const exactBody = new Uint8Array(2 * 1024 * 1024);
    const res = await safeFetch(ALLOWED_URL, makeStreamFetcher(exactBody));
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBe(2 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("timeout", () => {
  test("rejects when fetch hangs (simulated 1 ms timeout)", async () => {
    // Replace AbortSignal.timeout with a 1 ms version to avoid waiting 10 s in tests.
    const originalTimeout = AbortSignal.timeout;
    (AbortSignal as { timeout: typeof AbortSignal.timeout }).timeout = (_ms: number) =>
      originalTimeout.call(AbortSignal, 1);

    const hangingFetcher: Fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal as AbortSignal | undefined;
        const abort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort);
      });

    try {
      await expect(safeFetch(ALLOWED_URL, hangingFetcher)).rejects.toThrow();
    } finally {
      (AbortSignal as { timeout: typeof AbortSignal.timeout }).timeout = originalTimeout;
    }
  });
});
