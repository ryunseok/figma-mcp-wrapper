export interface Config {
  mode: "stdio" | "http";
  wsPort: number;
  httpPort: number;
  figmaToken: string | null;
  requestTimeoutMs: number;
}

export function loadConfig(): Config {
  const args = process.argv.slice(2);

  const getArg = (prefix: string) => args.find((a) => a.startsWith(prefix))?.split("=")[1];

  return {
    mode: (getArg("--mode=") ?? process.env.MCP_MODE ?? "stdio") as "stdio" | "http",
    wsPort: Number(getArg("--port=") ?? process.env.FIGMA_WS_PORT ?? 3055),
    httpPort: Number(getArg("--http-port=") ?? process.env.MCP_HTTP_PORT ?? 3056),
    figmaToken: process.env.FIGMA_ACCESS_TOKEN ?? null,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  };
}
