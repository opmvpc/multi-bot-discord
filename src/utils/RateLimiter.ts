export class RateLimiter {
  private lastRequestTime: number = 0;
  private minDelayBetweenRequests: number = 3000; // 3 secondes

  async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      const delay = this.minDelayBetweenRequests - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}
