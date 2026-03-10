import { v4 as uuidv4 } from "uuid";
import { PluginDisconnectedError, PluginTimeoutError } from "../errors/plugin.js";
import { logger } from "../utils/logger.js";
import type { WsRelay } from "./ws-relay.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  lastActivity: number;
}

export class PluginBridge {
  private pendingRequests = new Map<string, PendingRequest>();
  private currentChannel: string | null = null;

  constructor(
    private relay: WsRelay,
    private timeoutMs: number = 30000,
  ) {}

  get isConnected(): boolean {
    return true; // relay is always available (embedded)
  }

  async joinChannel(channel: string): Promise<unknown> {
    this.relay.registerHandler(channel, {
      onMessage: (data) => this.handleMessage(data),
    });
    this.currentChannel = channel;
    logger.info(`Joined channel: ${channel}`);
    return { success: true, channel };
  }

  async sendCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.currentChannel) {
      throw new PluginDisconnectedError();
    }

    return this.send(command, params);
  }

  private send(command: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new PluginTimeoutError(command, this.timeoutMs));
        }
      }, this.timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout, lastActivity: Date.now() });

      // Send through relay to Figma plugin
      this.relay.broadcast(this.currentChannel!, {
        id,
        command,
        params: { ...params, commandId: id },
      });

      logger.debug(`→ ${command}`);
    });
  }

  private handleMessage(data: unknown): void {
    try {
      const json = data as Record<string, unknown>;
      const message = json.message as Record<string, unknown> | undefined;

      if (!message) return;

      // Progress updates — reset timeout
      if (message.type === "progress_update") {
        const reqId = message.id as string;
        const req = this.pendingRequests.get(reqId);
        if (req) {
          req.lastActivity = Date.now();
          clearTimeout(req.timeout);
          req.timeout = setTimeout(() => {
            this.pendingRequests.delete(reqId);
            req.reject(new PluginTimeoutError("progress", this.timeoutMs));
          }, this.timeoutMs);
        }
        return;
      }

      // Final response
      const id = message.id as string | undefined;
      if (id && this.pendingRequests.has(id) && message.result !== undefined) {
        const req = this.pendingRequests.get(id)!;
        clearTimeout(req.timeout);
        this.pendingRequests.delete(id);

        if (message.error) {
          req.reject(new Error(message.error as string));
        } else {
          req.resolve(message.result);
        }
      }
    } catch (err) {
      logger.error(`Message parse error: ${err}`);
    }
  }
}
