import { z } from "zod";
import { pluginTool } from "../types.js";

export const getAnnotationsTool = pluginTool(
  "get_annotations",
  "Get annotations on a node in Figma",
  {
    nodeId: z.string().describe("Node ID to get annotations from"),
    includeCategories: z.boolean().optional().describe("Include category info"),
  },
  "get_annotations",
);

export const setAnnotationTool = pluginTool(
  "set_annotation",
  "Create or update an annotation on a node in Figma",
  {
    nodeId: z.string().describe("Node ID to annotate"),
    labelMarkdown: z.string().describe("Annotation text in markdown"),
    categoryId: z.string().optional().describe("Category ID"),
    annotationId: z.string().optional().describe("Existing annotation ID to update"),
    properties: z.record(z.string(), z.unknown()).optional(),
  },
  "set_annotation",
);

export const setMultipleAnnotationsTool = pluginTool(
  "set_multiple_annotations",
  "Create or update annotations on multiple nodes in Figma (batched)",
  {
    nodeId: z.string().describe("Parent node ID"),
    annotations: z
      .array(
        z.object({
          nodeId: z.string(),
          labelMarkdown: z.string(),
          categoryId: z.string().optional(),
        }),
      )
      .describe("Array of annotations"),
  },
  "set_multiple_annotations",
);
