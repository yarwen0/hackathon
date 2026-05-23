import { requireAuth } from '@/lib/auth';
import { getQuadrant } from '@/lib/data';
import { QuadrantClient } from '@/components/quadrant/QuadrantClient';

export const dynamic = 'force-dynamic';

export default async function QuadrantPage() {
  await requireAuth();
  const data = await getQuadrant();
  return <QuadrantClient data={data} />;
}
