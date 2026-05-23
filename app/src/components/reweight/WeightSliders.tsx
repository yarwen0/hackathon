'use client';

import { RotateCcw } from 'lucide-react';
import { useId } from 'react';

export type WeightKey = 'B' | 'C' | 'V';

export interface Weights {
  B: number;
  C: number;
  V: number;
}

const LABELS: Record<WeightKey, { label: string; sub: string; audit: string }> = {
  B: { label: 'Burden', sub: 'PLACES', audit: 'burden_component' },
  C: { label: 'Capacity', sub: 'NPPES + ACS', audit: 'capacity_component' },
  V: { label: 'Vulnerability', sub: 'SVI', audit: 'vulnerability_component' },
};

interface Props {
  value: Weights;
  onChange: (next: Weights) => void;
}

// Proportional rebalance: when key K changes to newValue, distribute (100 - newValue)
// across the other two keys in proportion to their current values.
export function rebalance(changed: WeightKey, newValue: number, current: Weights): Weights {
  const clamped = Math.max(0, Math.min(100, newValue));
  const others = (['B', 'C', 'V'] as const).filter((k) => k !== changed) as [WeightKey, WeightKey];
  const [a, b] = others;
  const sumOthers = current[a] + current[b];
  const remaining = 100 - clamped;
  if (sumOthers === 0) {
    return { ...current, [changed]: clamped, [a]: remaining / 2, [b]: remaining / 2 };
  }
  const aShare = current[a] / sumOthers;
  const bShare = current[b] / sumOthers;
  return {
    ...current,
    [changed]: clamped,
    [a]: Math.round(remaining * aShare * 1000) / 1000,
    [b]: Math.round(remaining * bShare * 1000) / 1000,
  };
}

export function WeightSliders({ value, onChange }: Props) {
  const baseId = useId();
  const isEqual = Math.abs(value.B - 33.333) < 0.5 && Math.abs(value.C - 33.333) < 0.5;
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Weights</h2>
        <button
          type="button"
          onClick={() => onChange({ B: 33.333, C: 33.333, V: 33.334 })}
          disabled={isEqual}
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={11} aria-hidden /> Reset to equal thirds
        </button>
      </div>
      {(['B', 'C', 'V'] as const).map((k) => {
        const v = value[k];
        const meta = LABELS[k];
        const inputId = `${baseId}-${k}`;
        return (
          <div key={k}>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor={inputId} className="text-sm">
                <span className="font-medium">{meta.label}</span>
                <span className="block text-2xs uppercase tracking-wider text-muted-foreground mt-0.5">
                  {meta.sub}
                </span>
              </label>
              <div className="font-mono tabular text-lg w-14 text-right">
                {Math.round(v)}<span className="text-muted-foreground text-sm">%</span>
              </div>
            </div>
            <div className="relative h-2.5">
              <div className="absolute inset-0 bg-muted" />
              <div
                className="absolute top-0 bottom-0 left-0"
                style={{ width: `${v}%`, background: 'var(--foreground)' }}
              />
              <input
                id={inputId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(v)}
                onChange={(e) => onChange(rebalance(k, Number(e.target.value), value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-grab"
                aria-label={`${meta.label} weight`}
              />
              <span
                aria-hidden
                className="absolute -top-1.5 w-4 h-4 -ml-2 bg-background border-2 border-foreground rounded-full pointer-events-none"
                style={{ left: `${v}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="text-2xs text-muted-foreground tabular pt-2 border-t">
        Sum: {(value.B + value.C + value.V).toFixed(1)}%{' '}
        <span className="ml-2">
          Server validates |sum − 1.0| ≤ 0.001 before running the parameterized SQL.
        </span>
      </div>
    </div>
  );
}
