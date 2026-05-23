import { NextResponse } from 'next/server';
import { clearSessionCookie, destroySession, getCurrentSessionId } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sessionId = await getCurrentSessionId();
  if (sessionId) await destroySession(sessionId);
  await clearSessionCookie();
  if (req.headers.get('accept')?.includes('application/json')) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
