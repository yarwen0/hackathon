import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireRole } from '@/lib/auth';
import { kv } from '@/lib/kv';
import { getCohort } from '@/lib/data';
import type { CohortCriteria, SavedCohort } from '@/lib/types';

export const runtime = 'nodejs';

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: Request) {
  const user = await requireRole(['program_officer', 'methodology_steward']);
  const body = (await req.json().catch(() => null)) as
    | { criteria: CohortCriteria; name?: string }
    | null;
  if (!body?.criteria) {
    return NextResponse.json({ error: 'Missing criteria.' }, { status: 400 });
  }
  const cohort = await getCohort(body.criteria);
  const token = `cohort_${randomBytes(4).toString('hex')}`;
  const record: SavedCohort = {
    token,
    name: body.name ?? null,
    criteria: body.criteria,
    ownerId: user.id,
    ownerEmail: user.email,
    createdAt: Date.now(),
    countySnapshot: cohort.rows.map((r) => r.fips),
  };
  await kv.set(`cohort:${token}`, record, { ex: TTL_SECONDS });
  // Index by owner so /cohort/saved can enumerate.
  await kv.set(`cohort:owner:${user.id}:${token}`, token, { ex: TTL_SECONDS });
  return NextResponse.json({ token, name: record.name, createdAt: record.createdAt });
}
