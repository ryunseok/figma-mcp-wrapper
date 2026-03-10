import { describe, expect, it, vi } from "vitest";
import { PluginDisconnectedError, PluginTimeoutError } from "../../errors/plugin.js";
import { PluginBridge } from "../plugin-bridge.js";
import type { WsRelay } from "../ws-relay.js";

vi.mock("../../utils/logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function createMockRelay() {
  let handler: { onMessage: (data: unknown) => void } | null = null;
  return {
    relay: {
      registerHandler: vi.fn((_ch: string, h: { onMessage: (data: unknown) => void }) => {
        handler = h;
      }),
      broadcast: vi.fn(),
      hasClients: vi.fn(() => true),
    } as unknown as WsRelay,
    /** Simulate a message arriving from the Figma plugin */
    simulateResponse(id: string, result: unknown, error?: string) {
      handler?.onMessage({
        message: { id, result, ...(error ? { error } : {}) },
      });
    },
    simulateProgress(id: string) {
      handler?.onMessage({
        message: { type: "progress_update", id },
      });
    },
  };
}

describe("PluginBridge", () => {
  it("throws PluginDisconnectedError if no channel joined", async () => {
    const { relay } = createMockRelay();
    const bridge = new PluginBridge(relay);

    await expect(bridge.sendCommand("test")).rejects.toThrow(PluginDisconnectedError);
  });

  it("joinChannel registers handler and sets channel", async () => {
    const { relay } = createMockRelay();
    const bridge = new PluginBridge(relay);

    const result = await bridge.joinChannel("test-ch");

    expect(result).toEqual({ success: true, channel: "test-ch" });
    expect(relay.registerHandler).toHaveBeenCalledWith("test-ch", expect.any(Object));
  });

  it("sendCommand broadcasts and resolves on response", async () => {
    const { relay, simulateResponse } = createMockRelay();
    const bridge = new PluginBridge(relay, 5000);

    await bridge.joinChannel("ch1");

    const promise = bridge.sendCommand("create_rectangle", { width: 100 });

    // Extract the ID from the broadcast call
    const broadcastCall = (relay.broadcast as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentMessage = broadcastCall[1] as { id: string };

    simulateResponse(sentMessage.id, { nodeId: "123:456" });

    const result = await promise;
    expect(result).toEqual({ nodeId: "123:456" });
  });

  it("rejects with Error when plugin returns error", async () => {
    const { relay, simulateResponse } = createMockRelay();
    const bridge = new PluginBridge(relay, 5000);

    await bridge.joinChannel("ch1");

    const promise = bridge.sendCommand("bad_command");

    const broadcastCall = (relay.broadcast as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentMessage = broadcastCall[1] as { id: string };

    simulateResponse(sentMessage.id, null, "Node not found");

    await expect(promise).rejects.toThrow("Node not found");
  });

  it("throws PluginTimeoutError when no response within timeout", async () => {
    vi.useFakeTimers();
    const { relay } = createMockRelay();
    const bridge = new PluginBridge(relay, 500);

    await bridge.joinChannel("ch1");

    const promise = bridge.sendCommand("slow_command");

    vi.advanceTimersByTime(600);

    await expect(promise).rejects.toThrow(PluginTimeoutError);
    vi.useRealTimers();
  });

  it("progress_update resets timeout", async () => {
    vi.useFakeTimers();
    const { relay, simulateProgress, simulateResponse } = createMockRelay();
    const bridge = new PluginBridge(relay, 500);

    await bridge.joinChannel("ch1");

    const promise = bridge.sendCommand("long_command");

    const broadcastCall = (relay.broadcast as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentMessage = broadcastCall[1] as { id: string };

    // Advance 400ms, then send progress (should reset timer)
    vi.advanceTimersByTime(400);
    simulateProgress(sentMessage.id);

    // Advance another 400ms — still within new timeout window
    vi.advanceTimersByTime(400);
    simulateResponse(sentMessage.id, { done: true });

    const result = await promise;
    expect(result).toEqual({ done: true });
    vi.useRealTimers();
  });
});
