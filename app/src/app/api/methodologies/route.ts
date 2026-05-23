import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMethodologies } from '@/lib/methodologies';

export const runtime = 'nodejs';

export async function GET() {
  await requireAuth();
  return NextResponse.json(await getMethodologies());
}
