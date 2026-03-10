import { z } from "zod";
import { pluginTool } from "../types.js";

export const batchExecuteTool = pluginTool(
  "batch_execute",
  "Execute multiple Figma commands in a single round-trip for better performance. Commands run sequentially within the plugin.",
  {
    commands: z
      .array(
        z.object({
          command: z.string().describe("Command name (e.g. create_rectangle, set_fill_color)"),
          params: z.record(z.string(), z.unknown()).describe("Command parameters"),
        }),
      )
      .min(1)
      .describe("Array of commands to execute sequentially"),
  },
  "batch_execute",
);
