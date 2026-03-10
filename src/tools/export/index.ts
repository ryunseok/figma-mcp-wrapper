import { z } from "zod";
import { ImageFormatPlugin } from "../../schemas/index.js";
import { pluginTool } from "../types.js";

export const exportNodeTool = pluginTool(
  "export_node_as_image",
  "Export a node as an image (PNG, JPG, SVG, or PDF)",
  {
    nodeId: z.string().describe("Node ID to export"),
    format: ImageFormatPlugin.optional().describe("Export format"),
    scale: z.number().min(0.01).max(4).optional().describe("Export scale (e.g. 2 for 2x)"),
  },
  "export_node_as_image",
);

export const getReactionsTool = pluginTool(
  "get_reactions",
  "Get prototyping reactions/interactions from nodes",
  {
    nodeIds: z.array(z.string()).describe("Node IDs to get reactions from"),
  },
  "get_reactions",
);

export const setDefaultConnectorTool = pluginTool(
  "set_default_connector",
  "Set the default connector style for FigJam connections",
  {
    connectorId: z.string().optional().describe("Connector style ID"),
  },
  "set_default_connector",
);

export const createConnectionsTool = pluginTool(
  "create_connections",
  "Create connector lines between nodes in FigJam",
  {
    connections: z
      .array(
        z.object({
          startNodeId: z.string(),
          endNodeId: z.string(),
          text: z.string().optional(),
        }),
      )
      .describe("Array of connections to create"),
  },
  "create_connections",
);
