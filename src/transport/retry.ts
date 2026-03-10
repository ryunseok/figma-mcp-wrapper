import { AuthError } from "../errors/auth.js";
import { FigmaMcpError } from "../errors/base.js";
import { RateLimitError } from "../errors/rate-limit.js";
import { logger } from "../utils/logger.js";

export interface RetryOptions {
  maxRetries: number;
  baseMs: number;
  maxMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseMs: 1000,
  maxMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AuthError) throw err;
      if (err instanceof FigmaMcpError && !err.retryable) throw err;
      if (attempt === opts.maxRetries) throw err;

      let delayMs: number;
      if (err instanceof RateLimitError) {
        delayMs = err.retryAfterMs;
      } else {
        const jitter = Math.random() * 500;
        delayMs = Math.min(opts.baseMs * 2 ** attempt + jitter, opts.maxMs);
      }

      logger.warn(
        `Retry ${attempt + 1}/${opts.maxRetries} after ${Math.round(delayMs)}ms: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("unreachable");
}
