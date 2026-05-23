import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { RoleBadge } from './RoleBadge';
import type { AuthUser } from '@/lib/types';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/compare', label: 'Compare' },
  { href: '/cohort', label: 'Cohort Builder' },
  { href: '/quadrant', label: 'Quadrant' },
  { href: '/reweight', label: 'Reweight Lab' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/ask', label: 'Ask the EGI' },
];

export function TopNav({ user }: { user: AuthUser | null }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {user?.role === 'external_collaborator' ? (
        <div className="bg-accent text-accent-foreground text-xs px-6 py-1.5 text-center tracking-wide uppercase">
          Viewing as External Collaborator — read-only access
        </div>
      ) : null}
      <div className="mx-auto max-w-content px-6 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-baseline gap-2 group" aria-label="EGI Workbench home">
          <span className="font-display text-xl tracking-tight">EGI</span>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground group-hover:text-foreground transition-colors">
            Workbench
          </span>
        </Link>
        {user ? (
          <nav className="hidden md:flex items-center gap-5 text-sm" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors',
                  'after:block after:h-px after:bg-foreground after:scale-x-0 after:origin-left after:transition-transform hover:after:scale-x-100',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden lg:inline text-xs text-muted-foreground tabular">
                {user.email}
              </span>
              <RoleBadge role={user.role} />
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 px-2 py-1"
                  aria-label="Log out"
                >
                  <LogOut size={12} aria-hidden />
                  Logout
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs uppercase tracking-wider text-foreground hover:text-accent transition-colors px-2 py-1"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
