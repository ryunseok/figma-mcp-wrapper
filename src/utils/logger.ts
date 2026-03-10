// MCP uses stdout for JSON-RPC, so all logs must go to stderr
export const logger = {
  info: (msg: string) => process.stderr.write(`[INFO] ${msg}\n`),
  warn: (msg: string) => process.stderr.write(`[WARN] ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[ERROR] ${msg}\n`),
  debug: (msg: string) => {
    if (process.env.DEBUG) process.stderr.write(`[DEBUG] ${msg}\n`);
  },
};
