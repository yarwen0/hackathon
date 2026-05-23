import { requireAuth } from '@/lib/auth';
import { STARTER_CHIPS } from '@/lib/ask-llm';
import { AskClient } from '@/components/ask/AskClient';

export const dynamic = 'force-dynamic';

export default async function AskPage() {
  await requireAuth();
  const llmAvailable = Boolean(process.env.GROQ_API_KEY);
  const chips = STARTER_CHIPS.map((c) => ({ id: c.id, label: c.label, question: c.question }));
  return <AskClient chips={chips} llmAvailable={llmAvailable} />;
}
