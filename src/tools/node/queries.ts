import { z } from "zod";
import { pluginTool, type ToolDefinition } from "../types.js";

export const getNodeInfoTool = pluginTool(
  "get_node_info",
  "Get detailed information about a specific node in Figma",
  {
    nodeId: z.string().describe("Node ID to get information about"),
  },
  "get_node_info",
);

export const getNodesInfoTool: ToolDefinition = {
  name: "get_nodes_info",
  description: "Get detailed information about multiple nodes in Figma",
  schema: {
    nodeIds: z.array(z.string()).describe("Array of node IDs to get information about"),
  },
  handler: async (params, ctx) => {
    const nodeIds = params.nodeIds as string[];
    const results = await Promise.all(
      nodeIds.map(async (nodeId) => {
        const result = await ctx.pluginBridge.sendCommand("get_node_info", { nodeId });
        return { nodeId, info: result };
      }),
    );
    return JSON.stringify(results);
  },
};
