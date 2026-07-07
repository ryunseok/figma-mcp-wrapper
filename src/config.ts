export interface Config {
  mode: "stdio" | "http";
  wsPort: number;
  httpPort: number;
  figmaToken: string | null;
  requestTimeoutMs: number;
  /** READ_ONLY=1 — REST 조회 도구만 등록 (원격 배포용, 플러그인 의존·쓰기 도구 미노출) */
  readOnly: boolean;
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
    readOnly: (getArg("--read-only=") ?? process.env.READ_ONLY) === "1",
  };
}
