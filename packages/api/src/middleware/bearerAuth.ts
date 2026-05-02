import { createMiddleware } from "hono/factory";

// Verify an HS256 JWT using Web Crypto API (Bun-native, no external deps).
async function verifyJwt(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  const signingInput = `${header}.${payload}`;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (ch) =>
      ch.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(signingInput),
    );
    if (!valid) return false;

    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (claims.exp !== undefined && claims.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

export const bearerAuth = createMiddleware(async (c, next) => {
  // In dev/test mode (no AUTHENTIK_CLIENT_ID), skip validation entirely.
  if (!process.env.AUTHENTIK_CLIENT_ID) {
    await next();
    return;
  }

  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET ?? "";
  const valid = await verifyJwt(token, secret);
  if (!valid) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
});
