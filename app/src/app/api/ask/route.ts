import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runAsk } from '@/lib/ask-llm';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await requireAuth();
  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question) return NextResponse.json({ error: 'Question required.' }, { status: 400 });

  // Rate-limit free-text only; chips bypass since they're pre-baked.
  const isChip = (await import('@/lib/ask-llm')).STARTER_CHIPS.some(
    (c) => c.question.toLowerCase() === question.toLowerCase(),
  );
  if (!isChip) {
    const r = await rateLimit(`ask:${user.id}`, 20, 60 * 60);
    if (!r.ok) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded — ${r.limit} requests per hour. Try again in a bit.`,
        },
        { status: 429 },
      );
    }
  }

  const response = await runAsk(question);
  return NextResponse.json(response);
}
