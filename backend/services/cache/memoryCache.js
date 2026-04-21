import { config } from '../../config/env.js';

export class MemoryCache {
  constructor({ ttlMs, maxEntries = 250 }) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const cached = this.store.get(key);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return structuredClone(cached.value);
  }

  set(key, value) {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.store.clear();
  }
}

export const analysisCache = new MemoryCache({
  ttlMs: config.analysisCacheTtlMs,
  maxEntries: 300,
});

export const aiCache = new MemoryCache({
  ttlMs: config.aiCacheTtlMs,
  maxEntries: 150,
});
