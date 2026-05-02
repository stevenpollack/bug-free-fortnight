import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { mcpLogger } from "./logging";
import { oauthRouter } from "./oauth";
import { createMcpServer } from "./server";

// Stateless mode: the SDK requires a fresh transport per request.
async function handleMcp(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const mcpRouter = new Hono()
  .route("/", oauthRouter)
  .on(["GET", "POST", "DELETE"], "/mcp", async (c) => {
    const rpcMethod = await peekRpcMethod(c.req.raw);
    mcpLogger.debug({ method: c.req.method, rpcMethod }, "mcp request");
    return handleMcp(c.req.raw);
  });

async function peekRpcMethod(req: Request): Promise<string | undefined> {
  if (req.method !== "POST") return undefined;
  try {
    const text = await req.clone().text();
    return text ? (JSON.parse(text) as { method?: string }).method : undefined;
  } catch {
    return undefined;
  }
}
