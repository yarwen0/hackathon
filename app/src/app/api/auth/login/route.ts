import { NextResponse } from 'next/server';
import {
  createSession,
  ensureSeed,
  findUserByEmail,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  await ensureSeed();
  const contentType = req.headers.get('content-type') ?? '';
  let email: string | undefined;
  let password: string | undefined;
  let next: string | undefined;

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string; next?: string }
      | null;
    email = body?.email;
    password = body?.password;
    next = body?.next;
  } else {
    const form = await req.formData();
    email = String(form.get('email') ?? '');
    password = String(form.get('password') ?? '');
    next = String(form.get('next') ?? '') || undefined;
  }

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Email and password required.' }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: 'Email or password is incorrect.' },
      { status: 401 },
    );
  }

  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);

  const target = next && next.startsWith('/') ? next : '/';
  if (contentType.includes('application/json')) {
    return NextResponse.json({
      ok: true,
      redirect: target,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
    });
  }
  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
