import { z } from "zod";
import { CrudAction, ImageFormatRest } from "../../schemas/index.js";
import type { ToolDefinition } from "../types.js";

export const getFileTool: ToolDefinition = {
  name: "get_file",
  description: "Get a Figma file's full document tree via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key (from URL)"),
    depth: z.number().optional().describe("Max depth of node tree to return"),
  },
  handler: async (params, ctx) => {
    const queryParams: Record<string, string> = {};
    if (params.depth !== undefined) queryParams.depth = String(params.depth);
    const result = await ctx.restClient.getFile(params.fileKey as string, queryParams);
    return JSON.stringify(result);
  },
};

export const getFileNodesTool: ToolDefinition = {
  name: "get_file_nodes",
  description: "Get specific nodes from a Figma file via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
    nodeIds: z.array(z.string()).describe("Node IDs to retrieve"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getFileNodes(
      params.fileKey as string,
      params.nodeIds as string[],
    );
    return JSON.stringify(result);
  },
};

export const getFileComponentsTool: ToolDefinition = {
  name: "get_file_components",
  description: "Get all components in a Figma file via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getFileComponents(params.fileKey as string);
    return JSON.stringify(result);
  },
};

export const getFileStylesTool: ToolDefinition = {
  name: "get_file_styles",
  description: "Get all styles in a Figma file via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getFileStyles(params.fileKey as string);
    return JSON.stringify(result);
  },
};

// --- Variables API (Phase 3) ---

export const getVariablesTool: ToolDefinition = {
  name: "get_variables",
  description:
    "Get all local variables (colors, numbers, strings, booleans) and collections from a Figma file via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getLocalVariables(params.fileKey as string);
    return JSON.stringify(result);
  },
};

export const getPublishedVariablesTool: ToolDefinition = {
  name: "get_published_variables",
  description: "Get all published variables from a Figma file (library) via REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getPublishedVariables(params.fileKey as string);
    return JSON.stringify(result);
  },
};

export const setVariablesTool: ToolDefinition = {
  name: "set_variables",
  description:
    "Create, update, or delete variables in a Figma file via REST API. Requires file_variables:write scope.",
  schema: {
    fileKey: z.string().describe("Figma file key"),
    variableCollections: z
      .array(
        z.object({
          action: CrudAction,
          id: z.string().optional().describe("Collection ID (for UPDATE/DELETE)"),
          name: z.string().optional().describe("Collection name (for CREATE/UPDATE)"),
          initialModeId: z.string().optional(),
        }),
      )
      .optional()
      .describe("Variable collection actions"),
    variableModes: z
      .array(
        z.object({
          action: CrudAction,
          id: z.string().optional(),
          name: z.string().optional(),
          variableCollectionId: z.string().optional(),
        }),
      )
      .optional()
      .describe("Variable mode actions"),
    variables: z
      .array(
        z.object({
          action: CrudAction,
          id: z.string().optional(),
          name: z.string().optional(),
          variableCollectionId: z.string().optional(),
          resolvedType: z.enum(["BOOLEAN", "FLOAT", "STRING", "COLOR"]).optional(),
          valuesByMode: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional()
      .describe("Variable actions"),
  },
  handler: async (params, ctx) => {
    const body: Record<string, unknown> = {};
    if (params.variableCollections) body.variableCollections = params.variableCollections;
    if (params.variableModes) body.variableModes = params.variableModes;
    if (params.variables) body.variables = params.variables;
    const result = await ctx.restClient.postVariables(params.fileKey as string, body);
    return JSON.stringify(result);
  },
};

export const getImagesTool: ToolDefinition = {
  name: "get_images",
  description: "Render nodes as images via Figma REST API",
  schema: {
    fileKey: z.string().describe("Figma file key"),
    nodeIds: z.array(z.string()).describe("Node IDs to render"),
    format: ImageFormatRest.optional().describe("Image format"),
    scale: z.number().optional().describe("Render scale (e.g. 2 for 2x)"),
  },
  handler: async (params, ctx) => {
    const result = await ctx.restClient.getImages(
      params.fileKey as string,
      params.nodeIds as string[],
      params.format as string | undefined,
      params.scale as number | undefined,
    );
    return JSON.stringify(result);
  },
};
