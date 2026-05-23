import { requireAuth } from '@/lib/auth';
import { getCompare, getCountyDirectory } from '@/lib/data';
import { CompareClient } from '@/components/compare/CompareClient';

export const dynamic = 'force-dynamic';

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  await requireAuth();
  const counties = await getCountyDirectory();
  const sp = await searchParams;
  const a = sp.a ?? null;
  const b = sp.b ?? null;
  const initial = a && b ? await getCompare(a, b) : null;
  return <CompareClient counties={counties} initial={initial} initialA={a} initialB={b} />;
}
