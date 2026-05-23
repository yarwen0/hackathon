import { NextResponse } from 'next/server';
import { getRanking } from '@/lib/data';
import { parseRankingFilters } from '@/lib/filters';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const filters = parseRankingFilters(searchParams);
  const data = await getRanking(filters);
  return NextResponse.json(data);
}
