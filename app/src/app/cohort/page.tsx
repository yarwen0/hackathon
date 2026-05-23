import { requireAuth } from '@/lib/auth';
import { getCohort, getRanking } from '@/lib/data';
import { parseCohortCriteria } from '@/lib/filters';
import { CohortClient } from '@/components/cohort/CohortClient';
import type { CohortCriteria } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CohortPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  const sp = new URLSearchParams();
  const params = await searchParams;
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') sp.set(k, v);
    else if (Array.isArray(v) && v.length > 0) sp.set(k, v[0]!);
  }
  let criteria: CohortCriteria = parseCohortCriteria(sp);

  // Seed: if ?seed=fips passed, use that county's region as a starting cohort.
  if (sp.get('seed')) {
    const seedFips = sp.get('seed')!;
    const allRanking = await getRanking({});
    const seedRow = allRanking.rows.find((r) => r.fips === seedFips);
    if (seedRow && Object.keys(criteria).length === 0) {
      criteria = { region: [seedRow.region], rural: seedRow.is_rural === 1 };
    }
  }

  const initial = await getCohort(criteria);
  const allCounties = await getRanking({});
  return (
    <CohortClient
      initial={initial}
      initialCriteria={criteria}
      allCounties={allCounties}
      user={user}
    />
  );
}
