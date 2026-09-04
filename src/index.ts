import "dotenv/config";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = process.env.MCP_API_TOKEN;
  if (!token) return next();
  const header = req.headers.authorization || "";
  if (header !== `Bearer ${token}`) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "ProjectFactory", transport: "streamable-http" }));

app.all("/mcp", auth, async (req, res) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => console.log(`ProjectFactory MCP listening on 0.0.0.0:${port} /mcp`));
