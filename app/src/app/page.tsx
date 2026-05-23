import { LandingClient } from '@/components/landing/LandingClient';
import { getRanking } from '@/lib/data';
import { parseRankingFilters } from '@/lib/filters';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const sp = new URLSearchParams();
  const params = await searchParams;
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') sp.set(k, v);
    else if (Array.isArray(v) && v.length > 0) sp.set(k, v[0]!);
  }
  const filters = parseRankingFilters(sp);
  const data = await getRanking(filters);
  return <LandingClient initial={data} initialFilters={filters} />;
}
