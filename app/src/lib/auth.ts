// Lucia-style session module. Sessions live in Vercel KV under `session:{id}`
// with 7-day TTL. Cookies are HTTP-only, Secure, SameSite=Lax, and signed
// (HMAC) with AUTH_SECRET so the server can detect tampering before
// round-tripping to KV.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { kv } from './kv';
import type { AuthUser, Role, SessionPayload } from './types';

const COOKIE_NAME = 'egi_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    // Demo-default; production must set AUTH_SECRET. This warning shows once.
    if (process.env.NODE_ENV !== 'production' && !globalThis.__egi_auth_warned) {
      console.warn(
        '[auth] AUTH_SECRET missing or short — using a deterministic demo default. Set AUTH_SECRET in .env.local for real sessions.',
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__egi_auth_warned = true;
    }
    return 'egi_demo_dev_secret_replace_me_in_production_environments';
  }
  return s;
}

declare global {
  // eslint-disable-next-line no-var
  var __egi_auth_warned: boolean | undefined;
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------- Password hashing (scrypt; native Node stdlib, no native deps) ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  const candidate = scryptSync(password, salt, 64);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------- Session CRUD against KV ----------

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(24).toString('hex');
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  await kv.set(`session:${sessionId}`, payload, { ex: SESSION_TTL_SECONDS });
  return sessionId;
}

export async function destroySession(sessionId: string): Promise<void> {
  await kv.del(`session:${sessionId}`);
}

export async function readSession(sessionId: string): Promise<SessionPayload | null> {
  const payload = await kv.get<SessionPayload>(`session:${sessionId}`);
  if (!payload) return null;
  if (payload.expiresAt < Date.now()) {
    await destroySession(sessionId);
    return null;
  }
  return payload;
}

// ---------- Cookie I/O ----------

interface CookieToken {
  id: string;
  sig: string;
}

function encodeCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

function decodeCookie(raw: string | undefined): CookieToken | null {
  if (!raw) return null;
  const idx = raw.indexOf('.');
  if (idx === -1) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!safeEqual(sig, sign(id))) return null;
  return { id, sig };
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeCookie(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  return decodeCookie(raw)?.id ?? null;
}

// ---------- User CRUD against KV ----------

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  displayName: string;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  return (await kv.get<StoredUser>(`user:byEmail:${email.toLowerCase()}`)) ?? null;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  return (await kv.get<StoredUser>(`user:byId:${id}`)) ?? null;
}

export async function saveUser(user: StoredUser): Promise<void> {
  await kv.set(`user:byEmail:${user.email.toLowerCase()}`, user);
  await kv.set(`user:byId:${user.id}`, user);
}

// ---------- High-level helpers used by routes / RSCs ----------

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureSeed();
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return null;
  const session = await readSession(sessionId);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireRole(role: Role | Role[]): Promise<AuthUser> {
  const u = await requireAuth();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(u.role)) {
    redirect('/login?reason=forbidden');
  }
  return u;
}

export function hasRole(user: AuthUser | null, role: Role | Role[]): boolean {
  if (!user) return false;
  const allowed = Array.isArray(role) ? role : [role];
  return allowed.includes(user.role);
}

// ---------- Lazy idempotent seed ----------

let seedRan = false;
let seedPromise: Promise<void> | null = null;

export async function ensureSeed(): Promise<void> {
  if (seedRan) return;
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const { seedUsers } = await import('./seed');
    await seedUsers();
    seedRan = true;
  })();
  return seedPromise;
}
