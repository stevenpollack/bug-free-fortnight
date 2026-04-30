import { expect, test } from "bun:test";
import { app } from "./index";

test("GET /api/health returns ok", async () => {
  const req = new Request("http://localhost/api/health");
  const res = await app.fetch(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ ok: true });
});
