import { z } from "zod";
import { pluginTool } from "../types.js";

export const moveNodeTool = pluginTool(
  "move_node",
  "Move a node to a new position in Figma",
  {
    nodeId: z.string().describe("Node ID to move"),
    x: z.number().describe("New X position"),
    y: z.number().describe("New Y position"),
  },
  "move_node",
);

export const resizeNodeTool = pluginTool(
  "resize_node",
  "Resize a node in Figma",
  {
    nodeId: z.string().describe("Node ID to resize"),
    width: z.number().describe("New width"),
    height: z.number().describe("New height"),
  },
  "resize_node",
);

export const cloneNodeTool = pluginTool(
  "clone_node",
  "Clone/duplicate a node in Figma",
  {
    nodeId: z.string().describe("Node ID to clone"),
    x: z.number().optional().describe("Optional X offset"),
    y: z.number().optional().describe("Optional Y offset"),
  },
  "clone_node",
);

export const deleteNodeTool = pluginTool(
  "delete_node",
  "Delete a node from Figma",
  {
    nodeId: z.string().describe("Node ID to delete"),
  },
  "delete_node",
);

export const deleteMultipleNodesTool = pluginTool(
  "delete_multiple_nodes",
  "Delete multiple nodes from Figma",
  {
    nodeIds: z.array(z.string()).describe("Array of node IDs to delete"),
  },
  "delete_multiple_nodes",
);

export const reorderChildTool = pluginTool(
  "reorder_child",
  "Move a child node to a specific index within its parent (for reordering auto-layout children)",
  {
    parentId: z.string().describe("Parent frame node ID"),
    nodeId: z.string().describe("Child node ID to reorder"),
    index: z.number().describe("Target index (0 = first child)"),
  },
  "reorder_child",
);

export const booleanOperationTool = pluginTool(
  "boolean_operation",
  "Perform boolean operation (union/subtract/intersect/exclude) on multiple nodes in Figma",
  {
    nodeIds: z.array(z.string()).min(2).describe("Node IDs to perform boolean operation on"),
    operation: z
      .enum(["UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"])
      .describe("Boolean operation type"),
    name: z.string().optional().describe("Name for the result node"),
  },
  "boolean_operation",
);
