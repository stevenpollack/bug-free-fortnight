import { Hono } from "hono";
import type { HonoEnv } from "../types";

export const configRouter = new Hono<HonoEnv>().get("/config", (c) => {
  return c.json({
    features: {
      recipeGeneration: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});
