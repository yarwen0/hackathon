import { requireAuth } from '@/lib/auth';
import { getReweight } from '@/lib/data';
import { ReweightClient } from '@/components/reweight/ReweightClient';

export const dynamic = 'force-dynamic';

export default async function ReweightPage() {
  await requireAuth();
  const initial = await getReweight({ burden: 1 / 3, capacity: 1 / 3, vulnerability: 1 / 3 });
  return <ReweightClient initial={initial} />;
}
