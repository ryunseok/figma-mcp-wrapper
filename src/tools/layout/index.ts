import { z } from "zod";
import {
  ColorFull,
  CounterAxisAlign,
  LayoutMode,
  LayoutSizing,
  PrimaryAxisAlign,
} from "../../schemas/index.js";
import { pluginTool } from "../types.js";

export const setLayoutModeTool = pluginTool(
  "set_layout_mode",
  "Set the auto layout mode of a frame in Figma",
  {
    nodeId: z.string().describe("Frame node ID"),
    layoutMode: LayoutMode.describe("Layout direction"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap mode"),
  },
  "set_layout_mode",
);

export const setPaddingTool = pluginTool(
  "set_padding",
  "Set the padding of an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("Frame node ID"),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
  },
  "set_padding",
);

export const setAxisAlignTool = pluginTool(
  "set_axis_align",
  "Set the alignment of an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("Frame node ID"),
    primaryAxisAlignItems: PrimaryAxisAlign.optional().describe("Main axis alignment"),
    counterAxisAlignItems: CounterAxisAlign.optional().describe("Cross axis alignment"),
  },
  "set_axis_align",
);

export const setLayoutSizingTool = pluginTool(
  "set_layout_sizing",
  "Set the sizing mode of an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("Frame node ID"),
    layoutSizingHorizontal: LayoutSizing.optional(),
    layoutSizingVertical: LayoutSizing.optional(),
  },
  "set_layout_sizing",
);

export const setItemSpacingTool = pluginTool(
  "set_item_spacing",
  "Set the item spacing of an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("Frame node ID"),
    itemSpacing: z.number().optional().describe("Gap between items"),
    counterAxisSpacing: z.number().optional().describe("Gap between wrapped rows/columns"),
  },
  "set_item_spacing",
);

// --- Phase 2: New layout tools ---

export const setConstraintsTool = pluginTool(
  "set_constraints",
  "Set the constraints (pinning) of a node for responsive layout",
  {
    nodeId: z.string().describe("Node ID"),
    horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional(),
    vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional(),
  },
  "set_constraints",
);

export const setGridTool = pluginTool(
  "set_grid",
  "Set layout grids (columns, rows, or pixel grid) on a frame",
  {
    nodeId: z.string().describe("Frame node ID"),
    grids: z
      .array(
        z.object({
          pattern: z.enum(["COLUMNS", "ROWS", "GRID"]).describe("Grid pattern"),
          sectionSize: z.number().optional(),
          count: z.number().optional().describe("Number of columns/rows"),
          gutterSize: z.number().optional().describe("Gutter size"),
          offset: z.number().optional(),
          alignment: z.enum(["MIN", "CENTER", "MAX", "STRETCH"]).optional(),
          visible: z.boolean().optional(),
          color: ColorFull.optional(),
        }),
      )
      .describe("Grid definitions"),
  },
  "set_grid",
);
