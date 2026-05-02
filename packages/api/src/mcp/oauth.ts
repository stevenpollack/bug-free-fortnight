import { Hono } from "hono";
import { mcpLogger } from "./logging";

// In-memory state — no persistence needed; tokens live 24h and restarts are rare.
interface PendingState {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  originalState: string | undefined;
}

interface AppCode {
  sub: string;
  iat: number;
}

const pendingStates = new Map<string, PendingState>();
const appCodes = new Map<string, AppCode>();

function isDev(): boolean {
  return !process.env.AUTHENTIK_CLIENT_ID;
}

// Sign a JWT using HS256 via Web Crypto API (no external deps needed in Bun).
async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signingInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${signingInput}.${sigB64}`;
}

export const oauthRouter = new Hono()
  .get("/.well-known/oauth-protected-resource", (c) => {
    mcpLogger.debug({ path: c.req.path }, "oauth probe");
    const base = externalBase(c.req);
    return c.json({ resource: base, authorization_servers: [base] });
  })
  .get("/.well-known/oauth-authorization-server", (c) => {
    mcpLogger.debug({ path: c.req.path }, "oauth probe");
    const base = externalBase(c.req);
    return c.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
    });
  })
  .get("/.well-known/openid-configuration", (c) => {
    mcpLogger.debug({ path: c.req.path }, "oauth probe");
    const base = externalBase(c.req);
    return c.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
    });
  })
  .post("/register", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const redirectUris: string[] = body.redirect_uris ?? [];
    const clientId = `mcp-client-${Date.now()}`;
    mcpLogger.debug({ clientId }, "client registered");
    return c.json(
      {
        client_id: clientId,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
      },
      201,
    );
  })
  .get("/authorize", (c) => {
    const clientId = c.req.query("client_id") ?? "";
    const redirectUri = c.req.query("redirect_uri") ?? "";
    const state = c.req.query("state");
    const codeChallenge = c.req.query("code_challenge") ?? "";
    const codeChallengeMethod = c.req.query("code_challenge_method") ?? "S256";

    if (isDev()) {
      // Dev/test stub: skip Authentik and redirect directly with a synthetic code.
      const code = Math.random().toString(36).slice(2, 18);
      try {
        const dest = new URL(redirectUri);
        dest.searchParams.set("code", code);
        if (state) dest.searchParams.set("state", state);
        return c.redirect(dest.toString(), 302);
      } catch {
        return c.json({ error: "invalid_redirect_uri" }, 400);
      }
    }

    const stateKey = crypto.randomUUID();
    pendingStates.set(stateKey, {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      originalState: state,
    });

    const base = externalBase(c.req);
    const authentikBase = process.env.AUTHENTIK_BASE_URL ?? "https://auth.clam.au";
    const upstream = new URL(`${authentikBase}/application/o/authorize/`);
    upstream.searchParams.set("response_type", "code");
    upstream.searchParams.set("client_id", process.env.AUTHENTIK_CLIENT_ID ?? "");
    upstream.searchParams.set("redirect_uri", `${base}/callback`);
    upstream.searchParams.set("state", stateKey);
    upstream.searchParams.set("scope", "openid profile email");

    return c.redirect(upstream.toString(), 302);
  })
  .get("/callback", async (c) => {
    const authentikCode = c.req.query("code");
    const stateKey = c.req.query("state");

    if (!authentikCode || !stateKey) {
      return c.json({ error: "missing_code_or_state" }, 400);
    }

    const pending = pendingStates.get(stateKey);
    if (!pending) {
      return c.json({ error: "unknown_state" }, 400);
    }
    pendingStates.delete(stateKey);

    const base = externalBase(c.req);
    const authentikBase = process.env.AUTHENTIK_BASE_URL ?? "https://auth.clam.au";

    const tokenRes = await fetch(`${authentikBase}/application/o/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authentikCode,
        client_id: process.env.AUTHENTIK_CLIENT_ID ?? "",
        client_secret: process.env.AUTHENTIK_CLIENT_SECRET ?? "",
        redirect_uri: `${base}/callback`,
      }).toString(),
    });

    if (!tokenRes.ok) {
      mcpLogger.error({ status: tokenRes.status }, "authentik token exchange failed");
      return c.json({ error: "upstream_token_exchange_failed" }, 502);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
      sub?: string;
    };

    if (!tokenData.access_token && !tokenData.id_token) {
      return c.json({ error: "no_token_in_upstream_response" }, 502);
    }

    // Derive subject from id_token claims if available, otherwise use a placeholder.
    let sub = "user";
    if (tokenData.id_token) {
      try {
        const parts = tokenData.id_token.split(".");
        const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
          sub?: string;
        };
        if (claims.sub) sub = claims.sub;
      } catch {
        // Non-fatal: keep the default sub
      }
    }

    const appCode = crypto.randomUUID();
    appCodes.set(appCode, { sub, iat: Math.floor(Date.now() / 1000) });

    try {
      const dest = new URL(pending.redirectUri);
      dest.searchParams.set("code", appCode);
      if (pending.originalState) dest.searchParams.set("state", pending.originalState);
      return c.redirect(dest.toString(), 302);
    } catch {
      return c.json({ error: "invalid_redirect_uri" }, 400);
    }
  })
  .post("/token", async (c) => {
    if (isDev()) {
      // Dev/test stub: issue a synthetic token without signature validation.
      const body = await c.req.parseBody().catch(() => ({}));
      const clientId =
        typeof body === "object" && "client_id" in body ? String(body.client_id) : "unknown";
      mcpLogger.info({ clientId }, "token issued (dev stub)");
      return c.json({
        access_token: `mcp-tok-${Date.now()}`,
        token_type: "Bearer",
        expires_in: 86400,
      });
    }

    const body = await c.req.parseBody().catch(() => ({}));
    const code = typeof body === "object" && "code" in body ? String(body.code) : "";

    const stored = appCodes.get(code);
    if (!stored) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    appCodes.delete(code);

    const secret = process.env.JWT_SECRET ?? "";
    if (!secret) {
      mcpLogger.error({}, "JWT_SECRET not set");
      return c.json({ error: "server_misconfiguration" }, 500);
    }

    const iat = stored.iat;
    const exp = iat + 86400;
    const token = await signJwt({ sub: stored.sub, iat, exp }, secret);

    mcpLogger.info({ sub: stored.sub }, "token issued");
    return c.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 86400,
    });
  });

// Derive the external base URL from the request, respecting X-Forwarded-Proto/Host
// (set by Tailscale Serve / reverse proxies) or EXTERNAL_URL env var.
function externalBase(req: { url: string; header: (name: string) => string | undefined }): string {
  if (process.env.EXTERNAL_URL) return process.env.EXTERNAL_URL.replace(/\/$/, "");
  const proto = req.header("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.header("x-forwarded-host") ?? req.header("host") ?? "localhost";
  return `${proto}://${host}`;
}
