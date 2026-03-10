import { z } from "zod";
import { ColorRGBA, SpacingUnit, TextDecoration } from "../../schemas/index.js";
import { pluginTool } from "../types.js";

export const scanTextNodesTool = pluginTool(
  "scan_text_nodes",
  "Scan and find all text nodes within a given node (supports intelligent chunking for large designs)",
  {
    nodeId: z.string().describe("Parent node ID to scan within"),
  },
  "scan_text_nodes",
);

export const setTextContentTool = pluginTool(
  "set_text_content",
  "Set the text content of a text node in Figma",
  {
    nodeId: z.string().describe("Text node ID"),
    text: z.string().describe("New text content"),
  },
  "set_text_content",
);

export const setMultipleTextContentsTool = pluginTool(
  "set_multiple_text_contents",
  "Set the text content of multiple text nodes in Figma (batched)",
  {
    nodeId: z.string().describe("Parent node ID"),
    textUpdates: z
      .array(
        z.object({
          nodeId: z.string().describe("Text node ID"),
          text: z.string().describe("New text content"),
        }),
      )
      .describe("Array of text updates"),
  },
  "set_multiple_text_contents",
);

// --- Phase 2: Text styling ---

export const setTextStyleTool = pluginTool(
  "set_text_style",
  "Set text styling (font, size, weight, alignment, color, etc.) on a text node",
  {
    nodeId: z.string().describe("Text node ID"),
    fontFamily: z.string().optional().describe("Font family (e.g. 'Pretendard')"),
    fontStyle: z.string().optional().describe("Font style (e.g. 'Bold', 'SemiBold', 'Regular')"),
    fontSize: z.number().optional().describe("Font size in px"),
    lineHeight: z
      .union([z.object({ value: z.number(), unit: SpacingUnit }), z.literal("AUTO")])
      .optional()
      .describe("Line height"),
    letterSpacing: z
      .object({ value: z.number(), unit: SpacingUnit })
      .optional()
      .describe("Letter spacing"),
    textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
    textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional(),
    textDecoration: TextDecoration.optional(),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
    color: ColorRGBA.optional().describe("Text color (RGBA 0-1)"),
  },
  "set_text_style",
);

export const setTextRangeStyleTool = pluginTool(
  "set_text_range_style",
  "Set text styling on a specific character range within a text node (mixed styling)",
  {
    nodeId: z.string().describe("Text node ID"),
    start: z.number().int().min(0).describe("Character start index"),
    end: z.number().int().min(0).describe("Character end index"),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional(),
    fontSize: z.number().optional(),
    color: ColorRGBA.optional(),
    textDecoration: TextDecoration.optional(),
  },
  "set_text_range_style",
);
