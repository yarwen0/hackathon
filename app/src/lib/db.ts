import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// Cached read-only handle. Next.js may reuse modules across requests, so we
// keep a single connection per process. `readonly: true` is defense-in-depth:
// even if the AI page somehow generated a destructive query, the connection
// would reject it.

let cached: Database.Database | null = null;

function resolveDbPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'database.db'),
    path.join(process.cwd(), 'app', 'data', 'database.db'),
    path.join(process.cwd(), '..', 'database.db'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `database.db not found. Tried:\n  ${candidates.join('\n  ')}`,
  );
}

export function db(): Database.Database {
  if (cached) return cached;
  const dbPath = resolveDbPath();
  const conn = new Database(dbPath, { readonly: true, fileMustExist: true });
  // No pragmas: readonly handles can't change journal mode or foreign-key
  // enforcement. Foreign keys are already enforced at load time.
  cached = conn;
  return conn;
}

// Generic typed prepared-statement runner. Cache statements per SQL string so
// we don't re-parse on every request.
const stmtCache = new Map<string, Database.Statement>();

export function prepared(sql: string): Database.Statement {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db().prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

export function all<T>(sql: string, params: unknown[] = []): T[] {
  return prepared(sql).all(...(params as never[])) as T[];
}

export function one<T>(sql: string, params: unknown[] = []): T | undefined {
  return prepared(sql).get(...(params as never[])) as T | undefined;
}

export function pluck<T>(sql: string, params: unknown[] = []): T[] {
  const s = db().prepare(sql);
  s.pluck(true);
  return s.all(...(params as never[])) as T[];
}
