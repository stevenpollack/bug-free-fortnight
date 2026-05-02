import { Hono } from "hono";
import { mcpLogger } from "./logging";

// Minimal OAuth 2.1 server satisfying MCP clients (Claude Desktop, Cursor, VS Code).
// Auto-approves all clients — network security (Tailscale) handles real auth.

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
    const redirectUri = c.req.query("redirect_uri") ?? "";
    const state = c.req.query("state");
    const code = Math.random().toString(36).slice(2, 18);
    try {
      const dest = new URL(redirectUri);
      dest.searchParams.set("code", code);
      if (state) dest.searchParams.set("state", state);
      return c.redirect(dest.toString(), 302);
    } catch {
      return c.json({ error: "invalid_redirect_uri" }, 400);
    }
  })
  .post("/token", async (c) => {
    const body = await c.req.parseBody().catch(() => ({}));
    const clientId =
      typeof body === "object" && "client_id" in body ? String(body.client_id) : "unknown";
    mcpLogger.info({ clientId }, "token issued");
    return c.json({
      access_token: `mcp-tok-${Date.now()}`,
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
