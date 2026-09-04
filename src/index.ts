import "dotenv/config";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server.js";
import { buildCompactMcpServer } from "./serverCompact.js";
import {
  authorize,
  getBaseUrl,
  mcpAuth,
  oauthMetadata,
  protectedResourceMetadata,
  token,
} from "./oauth.js";

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (req, res) => res.json({
  ok: true,
  service: "ProjectFactory",
  version: "1.6.0",
  transport: "streamable-http",
  oauth: true,
  mcp: `${getBaseUrl(req)}/mcp`,
  compact_mcp: `${getBaseUrl(req)}/mcp-compact`,
}));

// OAuth 2.0 / MCP discovery endpoints
app.get("/.well-known/oauth-authorization-server", oauthMetadata);
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
// Some clients request resource-scoped metadata. Keep this alias for compatibility.
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);
app.get("/authorize", authorize);
app.post("/token", token);

async function handleMcp(req:any,res:any,compact=false){
  const server = compact ? buildCompactMcpServer() : buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

app.all("/mcp", mcpAuth, async (req, res) => handleMcp(req,res,false));
app.all("/mcp-compact", mcpAuth, async (req, res) => handleMcp(req,res,true));

const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => {
  console.log(`ProjectFactory MCP v1.6 listening on 0.0.0.0:${port}`);
});
