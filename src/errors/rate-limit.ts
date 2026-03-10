import { FigmaMcpError } from "./base.js";

export class RateLimitError extends FigmaMcpError {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Figma API rate limit 초과 (${Math.ceil(retryAfterMs / 1000)}초 후 재시도)`,
      "RATE_LIMIT",
      true,
    );
  }
}
