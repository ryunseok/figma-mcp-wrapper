import { describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  it("allows requests within token budget", async () => {
    const limiter = new RateLimiter(5, 60_000);

    for (let i = 0; i < 5; i++) {
      await limiter.acquire(); // should not block
    }
  });

  it("waits when tokens are exhausted", async () => {
    const limiter = new RateLimiter(1, 200); // 1 token, refill every 200ms

    await limiter.acquire(); // consumes the single token

    const start = Date.now();
    await limiter.acquire(); // should wait ~200ms for refill
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90); // allow some timing slack
  });

  it("refills tokens after interval", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2, 1000);

    await limiter.acquire();
    await limiter.acquire(); // 0 tokens left

    vi.advanceTimersByTime(1000); // trigger refill

    // Should succeed without waiting after refill
    await limiter.acquire();
    vi.useRealTimers();
  });
});
