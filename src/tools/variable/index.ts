import { z } from "zod";
import { pluginTool } from "../types.js";

export const bindVariableTool = pluginTool(
  "bind_variable",
  "Bind a Figma variable to a node property (fills, strokes, opacity, padding, etc.)",
  {
    nodeId: z.string().describe("Node ID to bind variable to"),
    property: z
      .enum([
        "fills",
        "strokes",
        "effects",
        "opacity",
        "width",
        "height",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
        "itemSpacing",
        "cornerRadius",
        "fontSize",
        "lineHeight",
        "letterSpacing",
      ])
      .describe("Property to bind"),
    variableId: z.string().describe("Variable ID to bind"),
    fillIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("For fills/strokes: which paint index to bind (default 0)"),
  },
  "bind_variable",
);

export const unbindVariableTool = pluginTool(
  "unbind_variable",
  "Remove variable binding from a node property",
  {
    nodeId: z.string().describe("Node ID to unbind variable from"),
    property: z.string().describe("Property to unbind"),
  },
  "unbind_variable",
);
