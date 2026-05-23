import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getQuadrant } from '@/lib/data';

export const runtime = 'nodejs';

export async function GET() {
  await requireAuth();
  return NextResponse.json(await getQuadrant());
}
