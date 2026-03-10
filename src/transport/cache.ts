interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * TTL cache with size limit.
 * Used for read-only REST API responses (get_file, get_file_components, etc.)
 */
export class TtlCache {
  private store = new Map<string, CacheEntry>();

  constructor(
    private defaultTtlMs: number = 60_000,
    private maxEntries: number = 100,
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }
}
