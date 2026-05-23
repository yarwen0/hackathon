import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCohort } from '@/lib/data';
import type { CohortCriteria } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  await requireAuth();
  const body = (await req.json().catch(() => null)) as CohortCriteria | null;
  const data = await getCohort(body ?? {});
  return NextResponse.json(data);
}
