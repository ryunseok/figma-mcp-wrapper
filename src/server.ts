import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { z } from "zod";
import { type Config, loadConfig } from "./config.js";
import { allTools } from "./tools/_registry.js";
import type { ToolContext } from "./tools/types.js";
import { PluginBridge } from "./transport/plugin-bridge.js";
import { RestClient } from "./transport/rest-client.js";
import { WsRelay } from "./transport/ws-relay.js";
import { logger } from "./utils/logger.js";

/** Create and configure a new McpServer with all tools registered */
function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: "figma-mcp-wrapper",
    version: "0.2.0",
  });

  for (const tool of allTools) {
    const zodSchema: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(tool.schema)) {
      zodSchema[key] = value as z.ZodType;
    }

    server.tool(tool.name, tool.description, zodSchema, async (params) => {
      try {
        const result = await tool.handler(params as Record<string, unknown>, ctx);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Tool ${tool.name} failed: ${message}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    });
  }

  return server;
}

/** stdio mode: single session, Claude spawns the process */
async function startStdio(ctx: ToolContext) {
  const server = createMcpServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server running on stdio");
}

/** HTTP mode: persistent daemon, multiple sessions */
async function startHttp(ctx: ToolContext, config: Config) {
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS for local access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${config.httpPort}`);
    if (url.pathname !== "/mcp") {
      // Health check
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            sessions: sessions.size,
            tools: allTools.length,
            wsPort: config.wsPort,
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Check for existing session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // Handle DELETE for session cleanup
    if (req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        await session.transport.handleRequest(req, res);
        sessions.delete(sessionId);
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }

    // New session (POST with initialize)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createMcpServer(ctx);
    await server.connect(transport);

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        sessions.delete(sid);
        logger.info(`Session closed: ${sid.slice(0, 8)}...`);
      }
    };

    await transport.handleRequest(req, res);

    const sid = transport.sessionId;
    if (sid) {
      sessions.set(sid, { transport, server });
      logger.info(`New session: ${sid.slice(0, 8)}... (total: ${sessions.size})`);
    }
  });

  httpServer.listen(config.httpPort, () => {
    logger.info(`MCP HTTP server listening on http://localhost:${config.httpPort}/mcp`);
    logger.info(`Health check: http://localhost:${config.httpPort}/health`);
  });
}

async function main() {
  const config = loadConfig();

  logger.info("Starting figma-mcp-wrapper server");
  logger.info(`Mode: ${config.mode}`);
  logger.info(`WebSocket relay port: ${config.wsPort}`);
  logger.info(
    `REST API: ${config.figmaToken ? "configured" : "not configured (set FIGMA_ACCESS_TOKEN)"}`,
  );

  // Embedded WebSocket relay — Figma plugin connects here directly
  const relay = new WsRelay(config.wsPort);
  relay.start();

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    relay.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Shared context (all sessions use the same plugin bridge + REST client)
  const pluginBridge = new PluginBridge(relay, config.requestTimeoutMs);
  const restClient = new RestClient(config.figmaToken);
  const ctx: ToolContext = { pluginBridge, restClient };

  if (config.mode === "http") {
    await startHttp(ctx, config);
  } else {
    await startStdio(ctx);
  }

  logger.info(`Registered ${allTools.length} tools`);
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
