import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getReweight } from '@/lib/data';

export const runtime = 'nodejs';

function parse01(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

export async function GET(req: Request) {
  await requireAuth();
  const sp = new URL(req.url).searchParams;
  const b = parse01(sp.get('b'));
  const c = parse01(sp.get('c'));
  const v = parse01(sp.get('v'));
  if (b === null || c === null || v === null) {
    return NextResponse.json(
      { error: 'Weights b, c, v required as floats in [0, 1].' },
      { status: 400 },
    );
  }
  if (Math.abs(b + c + v - 1) > 0.005) {
    return NextResponse.json(
      { error: `Weights must sum to 1.0 (got ${(b + c + v).toFixed(3)}).` },
      { status: 400 },
    );
  }
  const data = await getReweight({ burden: b, capacity: c, vulnerability: v });
  return NextResponse.json(data);
}
