import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCompare } from '@/lib/data';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const a = searchParams.get('a');
  const b = searchParams.get('b');
  if (!a || !b) {
    return NextResponse.json({ error: 'Both a and b FIPS required.' }, { status: 400 });
  }
  const data = await getCompare(a, b);
  if (!data) return NextResponse.json({ error: 'County not found' }, { status: 404 });
  return NextResponse.json(data);
}
