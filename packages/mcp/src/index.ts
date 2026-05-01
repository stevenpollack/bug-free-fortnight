import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { checkAuth } from "./auth.js";
import { createMcpServer } from "./server.js";

const MCP_PORT = Number(process.env.MCP_PORT ?? 3002);
const MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN ?? "";

const mcpServer = createMcpServer();
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

await mcpServer.connect(transport);

const httpServer = createServer(async (req, res) => {
  if (MCP_BEARER_TOKEN && !checkAuth(req, MCP_BEARER_TOKEN)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  await transport.handleRequest(req, res);
});

httpServer.listen(MCP_PORT, () => {
  console.log(`MCP server listening on http://localhost:${MCP_PORT}`);
});
