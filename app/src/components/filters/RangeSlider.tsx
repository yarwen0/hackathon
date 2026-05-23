'use client';

import { useId } from 'react';

interface Props {
  label: string;
  min: number;
  max: number;
  step?: number;
  valueMin?: number;
  valueMax?: number;
  onChange: (min?: number, max?: number) => void;
  format?: (n: number) => string;
  unit?: string;
}

export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  format = (n) => String(n),
  unit = '',
}: Props) {
  const id = useId();
  const currentMin = valueMin ?? min;
  const currentMax = valueMax ?? max;
  const minPct = ((currentMin - min) / (max - min)) * 100;
  const maxPct = ((currentMax - min) / (max - min)) * 100;
  const isActive = valueMin !== undefined || valueMax !== undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={`${id}-min`} className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2 text-2xs tabular text-muted-foreground">
          <span className={isActive ? 'text-foreground' : ''}>
            {format(currentMin)}–{format(currentMax)}
            {unit}
          </span>
          {isActive ? (
            <button
              type="button"
              onClick={() => onChange(undefined, undefined)}
              className="text-2xs uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
              aria-label={`Clear ${label}`}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="relative h-1.5">
        <div className="absolute inset-0 bg-muted" />
        <div
          className="absolute top-0 bottom-0"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%`, background: 'var(--foreground)' }}
        />
        <input
          id={`${id}-min`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentMin}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(v <= min ? undefined : v, valueMax);
          }}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-grab"
          aria-label={`${label} minimum`}
        />
        <input
          id={`${id}-max`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentMax}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(valueMin, v >= max ? undefined : v);
          }}
          className="absolute inset-x-0 w-full h-full opacity-0 cursor-grab"
          aria-label={`${label} maximum`}
        />
        <span
          aria-hidden
          className="absolute -top-1 w-3 h-3 -ml-1.5 bg-background border border-foreground rounded-full pointer-events-none"
          style={{ left: `${minPct}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-1 w-3 h-3 -ml-1.5 bg-background border border-foreground rounded-full pointer-events-none"
          style={{ left: `${maxPct}%` }}
        />
      </div>
    </div>
  );
}
