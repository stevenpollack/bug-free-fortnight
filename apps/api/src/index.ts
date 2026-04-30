import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

const port = Number(process.env.PORT ?? 3001);

export default {
  port,
  fetch: app.fetch,
};

export { app };
