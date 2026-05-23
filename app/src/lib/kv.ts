// Adapter over Vercel KV (Upstash Redis). Falls back to an in-memory Map when
// KV credentials are absent so the app runs locally without provisioning KV.
// Production deployments set KV_REST_API_URL + KV_REST_API_TOKEN.

import { kv as vercelKv } from '@vercel/kv';

interface KVLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

interface MemEntry {
  value: unknown;
  expiresAt: number | null;
}

class MemoryKV implements KVLike {
  private store = new Map<string, MemEntry>();

  private expired(entry: MemEntry): boolean {
    return entry.expiresAt !== null && entry.expiresAt < Date.now();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.expired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, opts: { ex?: number } = {}): Promise<void> {
    const expiresAt = opts.ex ? Date.now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    // Preserve TTL if already set.
    const existing = this.store.get(key);
    const expiresAt = existing?.expiresAt ?? null;
    this.store.set(key, { value: next, expiresAt });
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) return;
    entry.expiresAt = Date.now() + seconds * 1000;
  }

  async keys(pattern: string): Promise<string[]> {
    const out: string[] = [];
    // Translate Redis glob to RegExp.
    const re = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    for (const [key, entry] of this.store) {
      if (this.expired(entry)) {
        this.store.delete(key);
        continue;
      }
      if (re.test(key)) out.push(key);
    }
    return out;
  }
}

const HAS_KV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Module-level fallback shared across hot reloads (Next dev) so sessions
// survive route handler module rebuilds.
const globalKey = Symbol.for('egi.kv.fallback');
const globalAny = globalThis as Record<symbol, unknown>;
if (!globalAny[globalKey]) {
  globalAny[globalKey] = new MemoryKV();
}
const memoryKv = globalAny[globalKey] as MemoryKV;

export const kv: KVLike = HAS_KV
  ? {
      async get<T>(key: string) {
        return (await vercelKv.get<T>(key)) ?? null;
      },
      async set<T>(key: string, value: T, opts: { ex?: number } = {}) {
        if (opts.ex) {
          await vercelKv.set(key, value, { ex: opts.ex });
        } else {
          await vercelKv.set(key, value);
        }
      },
      async del(key: string) {
        await vercelKv.del(key);
      },
      async incr(key: string) {
        return await vercelKv.incr(key);
      },
      async expire(key: string, seconds: number) {
        await vercelKv.expire(key, seconds);
      },
      async keys(pattern: string) {
        return await vercelKv.keys(pattern);
      },
    }
  : memoryKv;

export const isMemoryKV = !HAS_KV;
