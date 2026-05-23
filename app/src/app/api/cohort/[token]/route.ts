import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import { getCohort } from '@/lib/data';
import type { SavedCohort } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  await requireAuth();
  const { token } = await params;
  const record = await kv.get<SavedCohort>(`cohort:${token}`);
  if (!record) return NextResponse.json({ error: 'Cohort not found or expired.' }, { status: 404 });
  const cohort = await getCohort(record.criteria);
  return NextResponse.json({ record, cohort });
}
