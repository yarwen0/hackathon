'use client';

import { useState, useId } from 'react';
import { Info } from 'lucide-react';
import { getAuditEntry } from '@/lib/audit';

interface Props {
  metricId: string;
  className?: string;
}

export function AuditTooltip({ metricId, className }: Props) {
  const entry = getAuditEntry(metricId);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!entry) return null;
  return (
    <span className={`relative inline-block align-middle ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseLeave={() => setOpen(false)}
        aria-describedby={open ? id : undefined}
        aria-label={`Audit details for ${entry.label}`}
        className="text-muted-foreground hover:text-accent transition-colors inline-flex items-center"
      >
        <Info size={11} aria-hidden />
      </button>
      {open ? (
        <div
          id={id}
          role="tooltip"
          className="absolute left-0 top-full mt-1 z-20 w-80 max-w-[min(80vw,22rem)] bg-card border border-rule-strong shadow-lg p-4 text-left text-sm"
        >
          <div className="text-xs uppercase tracking-wider text-accent mb-1">{entry.label}</div>
          <p className="text-foreground leading-snug">{entry.description}</p>
          <dl className="mt-3 grid gap-1.5 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted-foreground uppercase tracking-wider w-16 shrink-0">
                Source
              </dt>
              <dd>
                {entry.sourceUrl ? (
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-rule hover:decoration-accent"
                  >
                    {entry.source}
                  </a>
                ) : (
                  entry.source
                )}
              </dd>
            </div>
            {entry.decision ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground uppercase tracking-wider w-16 shrink-0">
                  Decision
                </dt>
                <dd>{entry.decision}</dd>
              </div>
            ) : null}
            {entry.formula ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground uppercase tracking-wider w-16 shrink-0">
                  Formula
                </dt>
                <dd className="font-mono text-2xs">{entry.formula}</dd>
              </div>
            ) : null}
            {entry.sqlSnippet ? (
              <div className="mt-1">
                <dt className="sr-only">SQL</dt>
                <dd>
                  <pre className="bg-muted/60 p-2 text-2xs font-mono whitespace-pre-wrap overflow-x-auto">
                    {entry.sqlSnippet}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </span>
  );
}
