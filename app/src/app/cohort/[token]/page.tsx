import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import { getCohort, getRanking } from '@/lib/data';
import { CohortClient } from '@/components/cohort/CohortClient';
import type { SavedCohort } from '@/lib/types';
import { formatScore } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function SavedCohortPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requireAuth();
  const { token } = await params;
  const record = await kv.get<SavedCohort>(`cohort:${token}`);
  if (!record) notFound();
  const cohort = await getCohort(record.criteria);
  const allCounties = await getRanking({});

  return (
    <div>
      <div className="bg-muted/40 border-b no-print">
        <div className="mx-auto max-w-content px-6 py-3 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <Link href="/cohort" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft size={11} aria-hidden /> All cohorts
            </Link>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono tabular">Saved cohort {token}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              Saved by {record.ownerEmail} · {new Date(record.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            </span>
          </div>
          <div className="text-muted-foreground">
            {cohort.rows.length} counties · pop {Intl.NumberFormat('en-US').format(cohort.stats.totalPopulation)} · median EGI {formatScore(cohort.stats.medianEgi)}
          </div>
        </div>
      </div>
      <CohortClient
        initial={cohort}
        initialCriteria={record.criteria}
        allCounties={allCounties}
        user={user}
        initialSavedToken={token}
      />
    </div>
  );
}
