import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { z } from "zod";
import { type Config, loadConfig } from "./config.js";
import { allTools, readOnlyTools } from "./tools/_registry.js";
import type { ToolDefinition } from "./tools/types.js";
import type { ToolContext } from "./tools/types.js";
import { PluginBridge } from "./transport/plugin-bridge.js";
import { RestClient } from "./transport/rest-client.js";
import { WsRelay } from "./transport/ws-relay.js";
import { logger } from "./utils/logger.js";

/** Create and configure a new McpServer with the given tool set registered */
function createMcpServer(ctx: ToolContext, tools: ToolDefinition[]): McpServer {
  const server = new McpServer({
    name: "figma-mcp-wrapper",
    version: "0.2.0",
  });

  for (const tool of tools) {
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
async function startStdio(ctx: ToolContext, tools: ToolDefinition[]) {
  const server = createMcpServer(ctx, tools);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server running on stdio");
}

/** HTTP mode: persistent daemon, multiple sessions */
async function startHttp(relay: WsRelay, restClient: RestClient, config: Config) {
  const tools = config.readOnly ? readOnlyTools : allTools;
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer; pluginBridge: PluginBridge }
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
            tools: tools.length,
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

      // DELETE: clean up session after transport handles the request
      if (req.method === "DELETE") {
        await session.transport.handleRequest(req, res);
        session.pluginBridge.dispose();
        sessions.delete(sessionId);
        logger.info(`Session deleted: ${sessionId.slice(0, 8)}...`);
        return;
      }

      await session.transport.handleRequest(req, res);
      return;
    }

    // DELETE for unknown session
    if (req.method === "DELETE") {
      res.writeHead(404);
      res.end();
      return;
    }

    // New session — each gets its own PluginBridge for channel isolation
    const sessionPluginBridge = new PluginBridge(relay, config.requestTimeoutMs);
    const sessionCtx: ToolContext = { pluginBridge: sessionPluginBridge, restClient };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createMcpServer(sessionCtx, tools);
    await server.connect(transport);

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        sessions.get(sid)!.pluginBridge.dispose();
        sessions.delete(sid);
        logger.info(`Session closed: ${sid.slice(0, 8)}...`);
      }
    };

    await transport.handleRequest(req, res);

    const sid = transport.sessionId;
    if (sid) {
      sessions.set(sid, { transport, server, pluginBridge: sessionPluginBridge });
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

  const restClient = new RestClient(config.figmaToken);

  if (config.mode === "http") {
    // HTTP mode: each session gets its own PluginBridge for channel isolation
    await startHttp(relay, restClient, config);
  } else {
    // stdio mode: single session, single PluginBridge
    const pluginBridge = new PluginBridge(relay, config.requestTimeoutMs);
    const ctx: ToolContext = { pluginBridge, restClient };
    await startStdio(ctx, config.readOnly ? readOnlyTools : allTools);
  }

  logger.info(
    `Registered ${config.readOnly ? readOnlyTools.length : allTools.length} tools${config.readOnly ? " (READ_ONLY — REST 조회 전용)" : ""}`,
  );
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});
