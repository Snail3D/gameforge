export class Heartbeat {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastActivity: number = Date.now();
  private stallThresholdMs: number;
  private onStall: () => void;

  constructor(stallThresholdMs: number, onStall: () => void) {
    this.stallThresholdMs = stallThresholdMs;
    this.onStall = onStall;
  }

  start(intervalMs: number = 5000): void {
    this.ping();
    this.interval = setInterval(() => {
      if (Date.now() - this.lastActivity > this.stallThresholdMs) {
        this.onStall();
      }
    }, intervalMs);
  }

  ping(): void {
    this.lastActivity = Date.now();
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
