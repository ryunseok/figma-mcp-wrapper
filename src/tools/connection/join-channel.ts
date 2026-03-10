import { z } from "zod";
import type { ToolDefinition } from "../types.js";

export const joinChannelTool: ToolDefinition = {
  name: "join_channel",
  description: "Join a WebSocket channel to communicate with Figma plugin",
  schema: {
    channel: z.string().describe("Channel name to join"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.pluginBridge.joinChannel(params.channel as string);
    return JSON.stringify(result ?? { success: true, channel: params.channel });
  },
};
