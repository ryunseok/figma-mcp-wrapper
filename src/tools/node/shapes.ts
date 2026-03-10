import { z } from "zod";
import {
  ColorRGB,
  ColorRGBA,
  CounterAxisAlign,
  LayoutMode,
  LayoutSizing,
  PrimaryAxisAlign,
} from "../../schemas/index.js";
import { pluginTool } from "../types.js";

export const createRectangleTool = pluginTool(
  "create_rectangle",
  "Create a new rectangle in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width of the rectangle"),
    height: z.number().describe("Height of the rectangle"),
    name: z.string().optional().describe("Optional name for the rectangle"),
    parentId: z.string().optional().describe("Optional parent node ID"),
  },
  "create_rectangle",
  (p) => ({ ...p, name: p.name ?? "Rectangle" }),
);

export const createFrameTool = pluginTool(
  "create_frame",
  "Create a new frame in Figma with optional auto-layout settings",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width of the frame"),
    height: z.number().describe("Height of the frame"),
    name: z.string().optional().describe("Optional name"),
    parentId: z.string().optional().describe("Optional parent node ID"),
    fillColor: ColorRGBA.optional().describe("Optional fill color (RGBA 0-1)"),
    strokeColor: ColorRGBA.optional().describe("Optional stroke color"),
    layoutMode: LayoutMode.optional().describe("Auto layout mode"),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
    primaryAxisAlignItems: PrimaryAxisAlign.optional(),
    counterAxisAlignItems: CounterAxisAlign.optional(),
    layoutSizingHorizontal: LayoutSizing.optional(),
    layoutSizingVertical: LayoutSizing.optional(),
    itemSpacing: z.number().optional().describe("Gap between children"),
  },
  "create_frame",
  (p) => ({ ...p, name: p.name ?? "Frame" }),
);

export const createTextTool = pluginTool(
  "create_text",
  "Create a new text node in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    text: z.string().describe("Text content"),
    fontSize: z.number().optional().describe("Font size in px"),
    fontWeight: z.number().optional().describe("Font weight (400, 600, 700...)"),
    fontColor: ColorRGBA.optional().describe("Text color (RGBA 0-1)"),
    name: z.string().optional().describe("Optional name"),
    parentId: z.string().optional().describe("Optional parent node ID"),
  },
  "create_text",
);

export const createEllipseTool = pluginTool(
  "create_ellipse",
  "Create an ellipse (circle/oval/arc) in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width"),
    height: z.number().describe("Height"),
    name: z.string().optional().describe("Optional name"),
    parentId: z.string().optional().describe("Optional parent node ID"),
    arcStartAngle: z.number().optional().describe("Arc start angle in degrees (0-360)"),
    arcEndAngle: z.number().optional().describe("Arc end angle in degrees (0-360)"),
    arcType: z.enum(["INNER_RADIUS", "CHORD", "ROUND"]).optional().describe("Arc type"),
  },
  "create_ellipse",
);

export const createLineTool = pluginTool(
  "create_line",
  "Create a line between two points in Figma",
  {
    startX: z.number().describe("Start X"),
    startY: z.number().describe("Start Y"),
    endX: z.number().describe("End X"),
    endY: z.number().describe("End Y"),
    strokeWeight: z.number().optional().describe("Stroke weight (default 1)"),
    strokeColor: ColorRGBA.optional().describe("Stroke color (RGBA 0-1)"),
    name: z.string().optional(),
    parentId: z.string().optional(),
  },
  "create_line",
);

export const createPolygonTool = pluginTool(
  "create_polygon",
  "Create a polygon (triangle, pentagon, etc.) in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width"),
    height: z.number().describe("Height"),
    pointCount: z.number().optional().describe("Number of sides (default 3)"),
    name: z.string().optional(),
    parentId: z.string().optional(),
  },
  "create_polygon",
);

export const createStarTool = pluginTool(
  "create_star",
  "Create a star shape in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width"),
    height: z.number().describe("Height"),
    pointCount: z.number().optional().describe("Number of points (default 5)"),
    innerRadius: z.number().optional().describe("Inner radius ratio 0-1 (default 0.382)"),
    name: z.string().optional(),
    parentId: z.string().optional(),
  },
  "create_star",
);

export const createVectorTool = pluginTool(
  "create_vector",
  "Create a custom vector shape from SVG path data in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    vectorPaths: z
      .array(
        z.object({
          data: z.string().describe("SVG path data (d attribute)"),
          windingRule: z.enum(["EVENODD", "NONZERO"]).optional(),
        }),
      )
      .describe("Vector path definitions"),
    name: z.string().optional(),
    parentId: z.string().optional(),
  },
  "create_vector",
);

export const createGroupTool = pluginTool(
  "create_group",
  "Group multiple nodes together in Figma",
  {
    nodeIds: z.array(z.string()).min(1).describe("Node IDs to group"),
    name: z.string().optional().describe("Group name"),
  },
  "create_group",
);

export const createSectionTool = pluginTool(
  "create_section",
  "Create a section container in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width"),
    height: z.number().describe("Height"),
    name: z.string().describe("Section name"),
    fillColor: ColorRGB.optional().describe("Fill color (RGB 0-1)"),
  },
  "create_section",
);
