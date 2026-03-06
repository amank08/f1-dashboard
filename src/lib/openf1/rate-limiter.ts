class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRatePerMs: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = (1 - this.tokens) / this.refillRatePerMs;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillRatePerMs
    );
    this.lastRefill = now;
  }
}

class RateLimiter {
  private perSecond = new TokenBucket(3, 3 / 1000);
  private perMinute = new TokenBucket(30, 30 / 60000);

  async acquire(): Promise<void> {
    await this.perSecond.acquire();
    await this.perMinute.acquire();
  }
}

export const rateLimiter = new RateLimiter();
