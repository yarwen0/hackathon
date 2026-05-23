import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { kv } from '@/lib/kv';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SavedCohort } from '@/lib/types';
import { serializeCohortCriteria } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function SavedCohortsListPage() {
  const user = await requireRole(['program_officer', 'methodology_steward']);
  const ownerKeys = await kv.keys(`cohort:owner:${user.id}:*`);
  const tokens = (await Promise.all(ownerKeys.map((k) => kv.get<string>(k)))).filter(Boolean) as string[];
  const records = (
    await Promise.all(tokens.map((t) => kv.get<SavedCohort>(`cohort:${t}`)))
  ).filter((r): r is SavedCohort => Boolean(r));
  const list = records.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">My cohorts</div>
        <h1 className="font-display headline text-5xl mt-2">Saved cohorts</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Cohorts you&apos;ve saved. Share links expire after 30 days. Anyone with a link can view
          the cohort regardless of role.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No saved cohorts yet."
            description="Build a cohort and hit Save & share to keep it here."
            action={
              <Link
                href="/cohort"
                className="inline-block border border-foreground px-4 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
              >
                Build a cohort →
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-10 divide-y border-t border-b">
          {list.map((c) => (
            <li key={c.token} className="py-4 flex items-center justify-between gap-6">
              <div>
                <Link
                  href={`/cohort/${c.token}`}
                  className="font-display text-xl hover:text-accent transition-colors"
                >
                  {c.countySnapshot.length}-county cohort
                </Link>
                <div className="mt-1 text-xs text-muted-foreground tabular">
                  <span className="font-mono">{c.token}</span> · saved{' '}
                  {new Date(c.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div className="mt-1 text-xs text-muted-foreground max-w-prose">
                  Criteria: <code className="font-mono">{serializeCohortCriteria(c.criteria) || '(any)'}</code>
                </div>
              </div>
              <Link
                href={`/cohort/${c.token}`}
                className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Open <ArrowRight size={12} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
