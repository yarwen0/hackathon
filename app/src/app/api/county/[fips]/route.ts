import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCounty } from '@/lib/data';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ fips: string }> }) {
  await requireAuth();
  const { fips } = await params;
  const data = await getCounty(fips);
  if (!data) return NextResponse.json({ error: 'County not found' }, { status: 404 });
  return NextResponse.json(data);
}
