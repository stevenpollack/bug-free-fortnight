import { describe, expect, test } from "bun:test";
import { createApp } from "../app";

const app = createApp();

function post(body: unknown) {
  return app.fetch(
    new Request("http://localhost/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/log", () => {
  test("returns 204 on valid error-level body", async () => {
    const res = await post({ level: "error", message: "something went wrong" });
    expect(res.status).toBe(204);
  });

  test("returns 204 on valid warn-level body with scope and fields", async () => {
    const res = await post({
      level: "warn",
      message: "wake lock failed",
      scope: "web:wake-lock",
      fields: { reason: "permissions denied" },
    });
    expect(res.status).toBe(204);
  });

  test("returns 400 on invalid level (info is rejected)", async () => {
    const res = await post({ level: "info", message: "should be rejected" });
    expect(res.status).toBe(400);
  });

  test("returns 400 on invalid level (debug is rejected)", async () => {
    const res = await post({ level: "debug", message: "should be rejected" });
    expect(res.status).toBe(400);
  });

  test("returns 400 when message is missing", async () => {
    const res = await post({ level: "warn" });
    expect(res.status).toBe(400);
  });

  test("returns 400 when message exceeds 2000 chars", async () => {
    const res = await post({ level: "error", message: "x".repeat(2001) });
    expect(res.status).toBe(400);
  });

  test("returns 400 when fields has more than 50 keys", async () => {
    const fields = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, i]));
    const res = await post({ level: "warn", message: "too many fields", fields });
    expect(res.status).toBe(400);
  });
});
