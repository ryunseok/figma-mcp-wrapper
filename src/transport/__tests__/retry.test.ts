import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../../errors/auth.js";
import { FigmaMcpError } from "../../errors/base.js";
import { RateLimitError } from "../../errors/rate-limit.js";
import { withRetry } from "../retry.js";

// Suppress logger.warn output during tests
vi.mock("../../utils/logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(async () => "ok");
    expect(result).toBe("ok");
  });

  it("retries on transient error and succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new FigmaMcpError("server error", "API_ERROR", true);
        return "recovered";
      },
      { baseMs: 10, maxMs: 50 },
    );

    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("throws immediately on AuthError (no retry)", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new AuthError();
      }),
    ).rejects.toThrow(AuthError);

    expect(calls).toBe(1);
  });

  it("throws immediately on non-retryable FigmaMcpError", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new FigmaMcpError("bad request", "VALIDATION", false);
      }),
    ).rejects.toThrow(FigmaMcpError);

    expect(calls).toBe(1);
  });

  it("throws after max retries exhausted", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new FigmaMcpError("fail", "API_ERROR", true);
        },
        { maxRetries: 2, baseMs: 10, maxMs: 50 },
      ),
    ).rejects.toThrow("fail");

    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it("respects RateLimitError retryAfterMs", async () => {
    let calls = 0;
    const start = Date.now();

    await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw new RateLimitError(100); // wait 100ms
        return "ok";
      },
      { baseMs: 10, maxMs: 50 },
    );

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80); // ~100ms wait
    expect(calls).toBe(2);
  });

  it("caps delay at maxMs", async () => {
    let calls = 0;
    const start = Date.now();

    await withRetry(
      async () => {
        calls++;
        if (calls <= 2) throw new FigmaMcpError("err", "ERR", true);
        return "ok";
      },
      { baseMs: 10, maxMs: 30, maxRetries: 3 },
    );

    const elapsed = Date.now() - start;
    // With maxMs=30, total delay should be at most ~60ms + jitter, not exponential
    expect(elapsed).toBeLessThan(200);
  });
});
