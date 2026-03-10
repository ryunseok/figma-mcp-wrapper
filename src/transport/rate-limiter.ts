/**
 * Token bucket rate limiter.
 * Figma API limit: Starter = 60/min, Dev/Full = 120/min.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 60,
    private refillIntervalMs: number = 60_000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitMs = this.refillIntervalMs - (Date.now() - this.lastRefill);
    await new Promise((r) => setTimeout(r, Math.max(waitMs, 100)));
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const elapsed = Date.now() - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = Date.now();
    }
  }
}
