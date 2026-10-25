/**
 * Deterministic Clock Fake for tests.
 * Allows deterministic manipulation of time without relying on system timers.
 */
export class FakeClock {
  private currentMs: number;
  private readonly initialMs: number;

  constructor(initialDate: Date | number = new Date('2026-10-08T12:00:00.000Z')) {
    this.initialMs = typeof initialDate === 'number' ? initialDate : initialDate.getTime();
    this.currentMs = this.initialMs;
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  nowMs(): number {
    return this.currentMs;
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  advance(ms: number): void {
    if (ms < 0) {
      throw new Error('Cannot advance clock backwards');
    }
    this.currentMs += ms;
  }

  setTime(dateOrMs: Date | number): void {
    this.currentMs = typeof dateOrMs === 'number' ? dateOrMs : dateOrMs.getTime();
  }

  reset(): void {
    this.currentMs = this.initialMs;
  }
}

/**
 * Deterministic ID Generator Fake for tests.
 * Generates sequential, predictable identifiers.
 */
export class FakeIdGenerator {
  private counter = 0;
  private readonly defaultPrefix: string;

  constructor(defaultPrefix = 'id') {
    this.defaultPrefix = defaultPrefix;
  }

  next(prefix?: string): string {
    this.counter += 1;
    const p = prefix || this.defaultPrefix;
    return `${p}_${this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}
