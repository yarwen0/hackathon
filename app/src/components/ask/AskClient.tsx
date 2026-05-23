'use client';

import { useState, useTransition } from 'react';
import { SearchIcon, AlertTriangle, Sparkles, Zap } from 'lucide-react';
import { SqlDisplay } from './SqlDisplay';
import { ResultsTable } from './ResultsTable';
import type { AskResponse, StarterChip } from '@/lib/types';

interface Props {
  chips: Array<Pick<StarterChip, 'id' | 'label' | 'question'>>;
  llmAvailable: boolean;
}

export function AskClient({ chips, llmAvailable }: Props) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const body = (await res.json()) as AskResponse;
      startTransition(() => setResponse(body));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          AI-assisted query · safety net first, free text second
        </div>
        <h1 className="font-display headline text-5xl mt-2">Ask the EGI.</h1>
        <p className="mt-3 max-w-prose text-muted-foreground leading-relaxed">
          Natural-language questions against the read-only Mississippi EGI database. The model
          translates to SQL; you see the SQL before the results. The DB connection itself is
          read-only — even a query that bypassed our validators couldn&apos;t write.
        </p>
      </header>

      <section className="mt-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Start here · pre-baked questions
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setQuestion(c.question);
                void ask(c.question);
              }}
              disabled={loading}
              className="border border-rule-strong px-3 py-2 text-sm hover:bg-foreground hover:text-background transition-colors text-left max-w-md disabled:opacity-50"
            >
              <Sparkles size={11} className="inline mr-1.5 -mt-0.5" aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 border-t pt-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Or write your own question
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) void ask(question.trim());
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              llmAvailable
                ? 'e.g. Which Pine Belt counties have the highest obesity rates?'
                : '(LLM not configured — try the chips above)'
            }
            disabled={loading || !llmAvailable}
            className="flex-1 border border-rule-strong bg-background px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-1.5 bg-foreground text-background px-4 py-2.5 text-sm uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading || pending ? <Zap size={14} className="animate-pulse" aria-hidden /> : <SearchIcon size={14} aria-hidden />}
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>
        {!llmAvailable ? (
          <p className="mt-3 text-sm italic text-muted-foreground">
            Free-text input requires GROQ_API_KEY. The pre-baked questions above work without it.
          </p>
        ) : null}
      </section>

      {response ? (
        <section className="mt-10 border-t pt-8 grid gap-8 animate-fade-up">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Generated SQL</h2>
              <div className="text-2xs uppercase tracking-wider text-muted-foreground">
                {response.source === 'chip' ? 'Pre-baked chip' : 'LLM-generated · validated server-side'}
              </div>
            </div>
            <SqlDisplay sql={response.sql} />
            {response.explanation ? (
              <p className="mt-2 text-xs text-muted-foreground italic">{response.explanation}</p>
            ) : null}
          </div>

          {response.error ? (
            <div className="border-l-2 border-accent pl-4 py-3 bg-accent/5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle size={14} aria-hidden /> Query rejected
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{response.error}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Transparency is the safety mechanism — you can see exactly what the AI asked the
                database, and what the database refused to do.
              </p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Results</h2>
                <ResultsTable
                  columns={response.columns}
                  rows={response.rows}
                  truncated={response.truncated}
                />
              </div>
              {response.summary ? (
                <div className="border-l-2 border-accent pl-4 py-2">
                  <div className="text-2xs uppercase tracking-wider text-accent">Plain-English summary</div>
                  <p className="mt-1 text-base leading-relaxed">{response.summary}</p>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <section className="mt-16 pt-8 border-t text-xs text-muted-foreground max-w-prose space-y-2">
        <div className="font-medium text-foreground">How this is safe</div>
        <div>
          1. The LLM system prompt restricts output to SELECT-only on a whitelist of nine tables
          plus the EGI view.
        </div>
        <div>
          2. Server-side regex validation rejects any non-SELECT query, multi-statement query,
          comment, or forbidden keyword before it reaches the DB.
        </div>
        <div>
          3. The better-sqlite3 connection is opened with{' '}
          <code className="font-mono">readonly: true</code> — the database itself rejects writes.
        </div>
        <div>4. Free-text requests are rate-limited to 20 per hour per user via KV.</div>
      </section>
    </div>
  );
}
