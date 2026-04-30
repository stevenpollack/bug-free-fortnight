import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

describe("dev mode (no WEB_DIST_DIR)", () => {
  const app = createApp();

  test("GET /api/health returns 200", async () => {
    const res = await app.fetch(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("GET / returns 404 (no static serving)", async () => {
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(404);
  });
});

describe("production mode (WEB_DIST_DIR set)", () => {
  let distDir: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    distDir = mkdtempSync(join(tmpdir(), "family-recipes-test-"));
    writeFileSync(join(distDir, "index.html"), "<html><body>SPA</body></html>");
    writeFileSync(join(distDir, "assets", "app.js").replace("assets/", ""), "");
    // Create a simple JS asset to test static file serving
    writeFileSync(join(distDir, "app.js"), "console.log('hello')");
    app = createApp({ webDistDir: distDir });
  });

  afterAll(() => {
    rmSync(distDir, { recursive: true, force: true });
  });

  test("GET /api/health still returns 200", async () => {
    const res = await app.fetch(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("GET /some/deep/route returns index.html (SPA fallback)", async () => {
    const res = await app.fetch(new Request("http://localhost/some/deep/route"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<html>");
  });

  test("GET / returns index.html (SPA fallback)", async () => {
    const res = await app.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<html>");
  });

  test("GET /missing.png returns 404 (has file extension)", async () => {
    const res = await app.fetch(new Request("http://localhost/missing.png"));
    expect(res.status).toBe(404);
  });
});
