import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { kv } from '@/lib/kv';
import type { SavedCohort } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireRole(['program_officer', 'methodology_steward']);
  const ownerKeys = await kv.keys(`cohort:owner:${user.id}:*`);
  const tokens = await Promise.all(
    ownerKeys.map((k) => kv.get<string>(k)),
  );
  const records = await Promise.all(
    tokens.filter(Boolean).map((token) => kv.get<SavedCohort>(`cohort:${token}`)),
  );
  const list = records
    .filter((r): r is SavedCohort => Boolean(r))
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ cohorts: list });
}
