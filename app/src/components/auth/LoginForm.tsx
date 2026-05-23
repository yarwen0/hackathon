'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_USERS } from '@/lib/demo-users';

interface Props {
  next?: string;
}

export function LoginForm({ next }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(emailOverride?: string, passwordOverride?: string) {
    setError(null);
    const e = emailOverride ?? email;
    const p = passwordOverride ?? password;
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: e, password: p, next }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Login failed.');
      return;
    }
    const body = (await res.json()) as { redirect?: string };
    startTransition(() => {
      router.push(body.redirect ?? '/');
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2">
        {DEMO_USERS.map((u) => (
          <button
            key={u.id}
            type="button"
            disabled={pending}
            onClick={() => {
              setEmail(u.email);
              setPassword('demo');
              void submit(u.email, 'demo');
            }}
            className="w-full text-left border px-3 py-2.5 hover:bg-foreground hover:text-background transition-colors text-sm group"
          >
            <div className="text-2xs uppercase tracking-wider text-accent group-hover:text-accent-soft">
              {u.role.replace('_', ' ')}
            </div>
            <div className="mt-0.5 font-mono text-xs">{u.email}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-2xs uppercase tracking-wider text-muted-foreground">
        <div className="flex-1 border-t" />
        <span>or</span>
        <div className="flex-1 border-t" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
            placeholder="officer@gulfsouth.example"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent"
            placeholder="demo"
          />
        </div>
        {error ? (
          <div className="text-sm text-accent border-l-2 border-accent pl-3 py-1">{error}</div>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-foreground text-background py-2.5 text-sm uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>
    </div>
  );
}
