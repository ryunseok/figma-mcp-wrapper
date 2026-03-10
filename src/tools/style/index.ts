import { z } from "zod";
import { ColorFull, ColorRGBA } from "../../schemas/index.js";
import { pluginTool } from "../types.js";

export const setFillColorTool = pluginTool(
  "set_fill_color",
  "Set the fill color of a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    r: z.number().min(0).max(1).describe("Red (0-1)"),
    g: z.number().min(0).max(1).describe("Green (0-1)"),
    b: z.number().min(0).max(1).describe("Blue (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha (0-1)"),
  },
  "set_fill_color",
);

export const setStrokeColorTool = pluginTool(
  "set_stroke_color",
  "Set the stroke color and optional weight of a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    r: z.number().min(0).max(1).describe("Red (0-1)"),
    g: z.number().min(0).max(1).describe("Green (0-1)"),
    b: z.number().min(0).max(1).describe("Blue (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha (0-1)"),
    weight: z.number().optional().describe("Stroke weight"),
  },
  "set_stroke_color",
);

export const setCornerRadiusTool = pluginTool(
  "set_corner_radius",
  "Set the corner radius of a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    radius: z.number().describe("Corner radius value"),
    corners: z
      .object({
        topLeft: z.number().optional(),
        topRight: z.number().optional(),
        bottomRight: z.number().optional(),
        bottomLeft: z.number().optional(),
      })
      .optional()
      .describe("Optional per-corner radius"),
  },
  "set_corner_radius",
);

// --- Phase 2: New style tools ---

export const setEffectTool = pluginTool(
  "set_effect",
  "Set effects (drop shadow, inner shadow, blur) on a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    effects: z
      .array(
        z.object({
          type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
          visible: z.boolean().optional(),
          color: ColorFull.optional().describe("Shadow color (RGBA 0-1)"),
          offset: z.object({ x: z.number(), y: z.number() }).optional().describe("Shadow offset"),
          radius: z.number().optional().describe("Shadow blur radius"),
          spread: z.number().optional().describe("Shadow spread"),
          blurRadius: z.number().optional().describe("Blur radius (for blur effects)"),
        }),
      )
      .describe("Effects to apply"),
    append: z.boolean().optional().describe("Append to existing effects (default: replace)"),
  },
  "set_effect",
);

export const setGradientTool = pluginTool(
  "set_gradient",
  "Set a gradient fill on a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    gradient: z.object({
      type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
      stops: z
        .array(
          z.object({
            position: z.number().describe("Stop position (0-1)"),
            color: ColorRGBA,
          }),
        )
        .describe("Gradient color stops"),
      startPoint: z.object({ x: z.number(), y: z.number() }).optional(),
      endPoint: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
  },
  "set_gradient",
);

export const setImageFillTool = pluginTool(
  "set_image_fill",
  "Set an image fill on a node from a URL",
  {
    nodeId: z.string().describe("Node ID"),
    imageUrl: z.string().describe("Image URL to fill"),
    scaleMode: z
      .enum(["FILL", "FIT", "CROP", "TILE"])
      .optional()
      .describe("Scale mode (default FILL)"),
  },
  "set_image_fill",
);

export const setBlendModeTool = pluginTool(
  "set_blend_mode",
  "Set the blend mode of a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    blendMode: z
      .enum([
        "NORMAL",
        "DARKEN",
        "MULTIPLY",
        "COLOR_BURN",
        "LINEAR_BURN",
        "LIGHTEN",
        "SCREEN",
        "COLOR_DODGE",
        "LINEAR_DODGE",
        "OVERLAY",
        "SOFT_LIGHT",
        "HARD_LIGHT",
        "DIFFERENCE",
        "EXCLUSION",
        "HUE",
        "SATURATION",
        "COLOR",
        "LUMINOSITY",
      ])
      .describe("Blend mode"),
  },
  "set_blend_mode",
);

export const setOpacityTool = pluginTool(
  "set_opacity",
  "Set the opacity of a node in Figma",
  {
    nodeId: z.string().describe("Node ID"),
    opacity: z.number().min(0).max(1).describe("Opacity (0-1)"),
  },
  "set_opacity",
);

export const setStrokeDetailTool = pluginTool(
  "set_stroke_detail",
  "Set detailed stroke properties (weight, align, cap, join, dash pattern)",
  {
    nodeId: z.string().describe("Node ID"),
    strokeWeight: z.number().optional().describe("Stroke weight"),
    strokeAlign: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional(),
    strokeCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL"]).optional(),
    strokeJoin: z.enum(["MITER", "BEVEL", "ROUND"]).optional(),
    dashPattern: z.array(z.number()).optional().describe("Dash/gap pattern, e.g. [10, 5]"),
  },
  "set_stroke_detail",
);
