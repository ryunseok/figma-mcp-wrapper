import { z } from "zod";
import { pluginTool } from "../types.js";

export const getLocalComponentsTool = pluginTool(
  "get_local_components",
  "Get all local component definitions in the current Figma file",
  {},
  "get_local_components",
);

export const getStylesTool = pluginTool(
  "get_styles",
  "Get all styles defined in the current Figma document",
  {},
  "get_styles",
);

export const createInstanceTool = pluginTool(
  "create_component_instance",
  "Create an instance of a component in Figma",
  {
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    componentId: z.string().optional().describe("Local component ID (from get_local_components)"),
    componentKey: z
      .string()
      .optional()
      .describe("Published component key (for library components)"),
    parentId: z.string().optional().describe("Optional parent node ID"),
  },
  "create_component_instance",
  (params) => {
    if (!params.componentId && !params.componentKey) {
      throw new Error("componentId 또는 componentKey 중 하나는 필수입니다");
    }
    if (params.componentId && params.componentKey) {
      throw new Error("componentId와 componentKey를 동시에 지정할 수 없습니다");
    }
    return params;
  },
);

export const getInstanceOverridesTool = pluginTool(
  "get_instance_overrides",
  "Get the override properties of a component instance",
  {
    nodeId: z.string().optional().describe("Instance node ID (uses selection if omitted)"),
  },
  "get_instance_overrides",
);

export const setInstanceOverridesTool = pluginTool(
  "set_instance_overrides",
  "Apply overrides from a source instance to target nodes",
  {
    sourceInstanceId: z.string().describe("Source instance node ID"),
    targetNodeIds: z.array(z.string()).describe("Target node IDs to apply overrides to"),
  },
  "set_instance_overrides",
);

// --- Phase 3: Component/Variant creation ---

export const createComponentTool = pluginTool(
  "create_component",
  "Create a new component or convert an existing node to a component in Figma",
  {
    name: z.string().describe("Component name"),
    x: z.number().optional().describe("X position (for new component)"),
    y: z.number().optional().describe("Y position (for new component)"),
    width: z.number().optional().describe("Width (for new component)"),
    height: z.number().optional().describe("Height (for new component)"),
    fromNodeId: z.string().optional().describe("Convert existing node to component"),
    parentId: z.string().optional().describe("Optional parent node ID"),
  },
  "create_component",
);

export const createComponentSetTool = pluginTool(
  "create_component_set",
  "Combine multiple components into a variant set (ComponentSet) in Figma",
  {
    componentIds: z.array(z.string()).min(2).describe("Component IDs to combine as variants"),
    name: z.string().optional().describe("Variant set name"),
  },
  "create_component_set",
);

export const setComponentPropertyTool = pluginTool(
  "set_component_property",
  "Add, edit, or delete a component property (variant axis, text, boolean, instance swap)",
  {
    componentId: z.string().describe("Component or ComponentSet node ID"),
    action: z.enum(["ADD", "EDIT", "DELETE"]).describe("Action to perform"),
    propertyName: z.string().describe("Property name"),
    propertyType: z
      .enum(["VARIANT", "TEXT", "BOOLEAN", "INSTANCE_SWAP"])
      .optional()
      .describe("Property type (required for ADD)"),
    defaultValue: z.string().optional().describe("Default value"),
    variantOptions: z.array(z.string()).optional().describe("For VARIANT type: available options"),
  },
  "set_component_property",
);
