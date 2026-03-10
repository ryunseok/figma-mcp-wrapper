import { z } from "zod";
import { pluginTool, type ToolDefinition } from "../types.js";

export const getDocumentInfoTool = pluginTool(
  "get_document_info",
  "Get detailed information about the current Figma document",
  {},
  "get_document_info",
);

export const getSelectionTool = pluginTool(
  "get_selection",
  "Get information about the current selection in Figma",
  {},
  "get_selection",
);

export const readDesignTool = pluginTool(
  "read_my_design",
  "Read detailed information about the currently selected design elements",
  {},
  "read_my_design",
);

export const scanNodesByTypesTool = pluginTool(
  "scan_nodes_by_types",
  "Scan for nodes of specific types within a parent node",
  {
    nodeId: z.string().describe("Parent node ID to scan within"),
    types: z.array(z.string()).describe("Node types to scan for (e.g. ['TEXT', 'FRAME'])"),
  },
  "scan_nodes_by_types",
);

export const setFocusTool = pluginTool(
  "set_focus",
  "Select and scroll to a specific node in Figma",
  {
    nodeId: z.string().describe("Node ID to focus on"),
  },
  "set_focus",
);

export const setSelectionsTool = pluginTool(
  "set_selections",
  "Select multiple nodes in Figma",
  {
    nodeIds: z.array(z.string()).describe("Array of node IDs to select"),
  },
  "set_selections",
);
