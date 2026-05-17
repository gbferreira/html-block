import type { BoardState, StateStorage } from "./types.js";

/**
 * Default storage adapter. Persists each board state as JSON in
 * `window.localStorage` under the board's storageKey. Falls back to a
 * no-op when localStorage is unavailable (e.g. SSR, restricted contexts).
 */
export class LocalStorageAdapter implements StateStorage {
  private get storage(): Storage | null {
    try {
      if (typeof globalThis === "undefined") return null;
      const ls = (globalThis as { localStorage?: Storage }).localStorage;
      return ls ?? null;
    } catch {
      return null;
    }
  }

  load(key: string): BoardState | null {
    const ls = this.storage;
    if (!ls) return null;
    try {
      const raw = ls.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BoardState;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.blocks)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  save(key: string, state: BoardState): void {
    const ls = this.storage;
    if (!ls) return;
    try {
      ls.setItem(key, JSON.stringify(state));
    } catch {
      // Quota or serialization errors are silently ignored; consumers
      // can layer their own adapter for stricter handling.
    }
  }

  remove(key: string): void {
    const ls = this.storage;
    if (!ls) return;
    try {
      ls.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/** In-memory adapter, useful for tests and SSR. */
export class MemoryAdapter implements StateStorage {
  private store = new Map<string, BoardState>();

  load(key: string): BoardState | null {
    return this.store.get(key) ?? null;
  }

  save(key: string, state: BoardState): void {
    this.store.set(key, structuredClone(state));
  }

  remove(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Wraps a StateStorage so that `save` calls coalesce within a debounce
 * window. The most recent state is flushed when the timer fires.
 */
export class DebouncedStorage implements StateStorage {
  private pending: { key: string; state: BoardState } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly inner: StateStorage,
    private readonly delayMs = 150,
  ) {}

  load(key: string): BoardState | null | Promise<BoardState | null> {
    return this.inner.load(key);
  }

  save(key: string, state: BoardState): void {
    this.pending = { key, state };
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.pending;
      this.pending = null;
      if (next) {
        void this.inner.save(next.key, next.state);
      }
    }, this.delayMs);
  }

  remove(key: string): void {
    if (this.pending && this.pending.key === key) this.pending = null;
    void this.inner.remove(key);
  }

  /** Flush any pending write synchronously. */
  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const next = this.pending;
    this.pending = null;
    if (next) {
      void this.inner.save(next.key, next.state);
    }
  }
}
