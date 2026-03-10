import { WebSocket, WebSocketServer } from "ws";
import { logger } from "../utils/logger.js";

export interface InternalHandler {
  onMessage(data: unknown): void;
}

/**
 * Embedded WebSocket relay server.
 * Figma Plugin connects here as a client.
 * PluginBridge registers as an internal handler (no extra WS hop).
 */
export class WsRelay {
  private wss: WebSocketServer | null = null;
  private channels = new Map<string, Set<WebSocket>>();
  private internalHandlers = new Map<string, InternalHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private alive = new WeakMap<WebSocket, boolean>();

  constructor(
    private port: number,
    private heartbeatMs: number = 30_000,
  ) {}

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws) => {
      logger.info("Figma plugin connected");
      this.alive.set(ws, true);
      ws.on("pong", () => this.alive.set(ws, true));

      ws.send(JSON.stringify({ type: "system", message: "Please join a channel to start" }));

      ws.on("message", (raw) => this.handleExternal(ws, raw.toString()));

      ws.on("close", () => {
        this.removeFromAllChannels(ws);
        logger.info("Figma plugin disconnected");
      });

      ws.on("error", (err) => {
        logger.error(`Plugin WS error: ${err.message}`);
      });
    });

    this.wss.on("error", (err) => {
      logger.error(`Relay server error: ${err.message}`);
    });

    this.startHeartbeat();
    logger.info(`WebSocket relay listening on port ${this.port}`);
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close(1001, "Server shutting down");
      }
      this.wss.close();
      this.wss = null;
    }
    this.channels.clear();
    this.internalHandlers.clear();
    logger.info("WebSocket relay stopped");
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.wss) return;
      for (const ws of this.wss.clients) {
        if (!this.alive.get(ws)) {
          logger.warn("Heartbeat failed — terminating dead connection");
          this.removeFromAllChannels(ws);
          ws.terminate();
          continue;
        }
        this.alive.set(ws, false);
        ws.ping();
      }
    }, this.heartbeatMs);
  }

  private removeFromAllChannels(ws: WebSocket): void {
    this.channels.forEach((clients, ch) => {
      if (clients.delete(ws)) {
        logger.debug(`Plugin removed from channel: ${ch}`);
      }
    });
  }

  /** Register an internal handler for a channel (used by PluginBridge) */
  registerHandler(channel: string, handler: InternalHandler): void {
    this.internalHandlers.set(channel, handler);
    logger.debug(`Internal handler registered for channel: ${channel}`);
  }

  /** Send a message from internal handler to all external clients in a channel */
  broadcast(channel: string, message: unknown): void {
    const clients = this.channels.get(channel);
    if (!clients || clients.size === 0) {
      logger.warn(`No Figma plugin in channel "${channel}" — is the plugin running?`);
      return;
    }

    const payload = JSON.stringify({
      type: "broadcast",
      message,
      sender: "peer",
      channel,
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /** Check if any external client is connected to a channel */
  hasClients(channel: string): boolean {
    const clients = this.channels.get(channel);
    if (!clients) return false;
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) return true;
    }
    return false;
  }

  private handleExternal(ws: WebSocket, raw: string): void {
    try {
      const data = JSON.parse(raw);

      if (data.type === "join") {
        this.handleJoin(ws, data);
        return;
      }

      if (data.type === "message") {
        this.handleChannelMessage(ws, data);
        return;
      }
    } catch (err) {
      logger.error(`Relay parse error: ${err}`);
    }
  }

  private handleJoin(ws: WebSocket, data: { channel?: string; id?: string }): void {
    const channel = data.channel;
    if (!channel || typeof channel !== "string") {
      ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
      return;
    }

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(ws);

    ws.send(JSON.stringify({ type: "system", message: `Joined channel: ${channel}`, channel }));
    ws.send(
      JSON.stringify({
        type: "system",
        message: { id: data.id, result: `Connected to channel: ${channel}` },
        channel,
      }),
    );

    logger.info(`Figma plugin joined channel: ${channel}`);
  }

  private handleChannelMessage(ws: WebSocket, data: { channel?: string; message?: unknown }): void {
    const channel = data.channel;
    if (!channel) return;

    const clients = this.channels.get(channel);
    if (!clients?.has(ws)) {
      ws.send(JSON.stringify({ type: "error", message: "You must join the channel first" }));
      return;
    }

    // Route to internal handler (PluginBridge)
    const handler = this.internalHandlers.get(channel);
    if (handler) {
      handler.onMessage(data);
    }

    // Also broadcast to other external clients in the same channel
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "broadcast",
            message: data.message,
            sender: "peer",
            channel,
          }),
        );
      }
    }
  }
}
