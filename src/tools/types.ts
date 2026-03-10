import type { PluginBridge } from "../transport/plugin-bridge.js";
import type { RestClient } from "../transport/rest-client.js";

export interface ToolContext {
  pluginBridge: PluginBridge;
  restClient: RestClient;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (params: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

/** Helper: create a plugin-bridge tool that simply forwards a command */
export function pluginTool(
  name: string,
  description: string,
  schema: Record<string, unknown>,
  command?: string,
  mapParams?: (params: Record<string, unknown>) => Record<string, unknown>,
): ToolDefinition {
  return {
    name,
    description,
    schema,
    handler: async (params, ctx) => {
      const mapped = mapParams ? mapParams(params) : params;
      const result = await ctx.pluginBridge.sendCommand(command ?? name, mapped);
      return JSON.stringify(result);
    },
  };
}
