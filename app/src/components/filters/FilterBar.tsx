'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { RankingFilters, Region } from '@/lib/types';

const REGIONS: Region[] = ['Delta', 'Coastal', 'Pine Belt', 'Other'];

interface Props {
  value: RankingFilters;
  onChange: (next: RankingFilters) => void;
  total: number;
  totalAll: number;
}

export function FilterBar({ value, onChange, total, totalAll }: Props) {
  const active = useMemo(() => countActive(value), [value]);

  function toggleRegion(r: Region) {
    const set = new Set(value.region ?? []);
    if (set.has(r)) set.delete(r);
    else set.add(r);
    onChange({ ...value, region: set.size ? Array.from(set) : undefined });
  }

  function toggleQuintile(q: number) {
    const set = new Set(value.quintile ?? []);
    if (set.has(q)) set.delete(q);
    else set.add(q);
    onChange({ ...value, quintile: set.size ? Array.from(set) : undefined });
  }

  return (
    <div className="border-b bg-background sticky top-[57px] z-30 no-print shadow-[0_8px_16px_-12px_rgba(26,22,18,0.18)]">
      <div className="mx-auto max-w-content px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">Region</span>
          <div className="flex">
            {REGIONS.map((r) => {
              const on = value.region?.includes(r) ?? false;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  aria-pressed={on}
                  className={`-mr-px border px-2 py-1 text-2xs uppercase tracking-wider transition-colors ${
                    on
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-rule-strong text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">Rurality</span>
          <div className="flex">
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, rural: value.rural === true ? undefined : true })
              }
              aria-pressed={value.rural === true}
              className={`-mr-px border px-2 py-1 text-2xs uppercase tracking-wider transition-colors ${
                value.rural === true
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-rule-strong text-muted-foreground hover:text-foreground'
              }`}
            >
              Rural
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, rural: value.rural === false ? undefined : false })
              }
              aria-pressed={value.rural === false}
              className={`border px-2 py-1 text-2xs uppercase tracking-wider transition-colors ${
                value.rural === false
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-rule-strong text-muted-foreground hover:text-foreground'
              }`}
            >
              Urban
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">Quintile</span>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((q) => {
              const on = value.quintile?.includes(q) ?? false;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => toggleQuintile(q)}
                  aria-pressed={on}
                  className={`-mr-px border w-7 h-7 text-2xs tabular transition-colors ${
                    on
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-rule-strong text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Q{q}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-muted-foreground">Search</span>
          <input
            type="search"
            value={value.search ?? ''}
            onChange={(e) =>
              onChange({ ...value, search: e.target.value || undefined })
            }
            placeholder="county name"
            className="bg-background border border-rule-strong px-2 py-1 text-sm w-36 font-mono focus:border-accent focus:outline-none"
          />
        </label>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular">
            <span className="text-foreground font-mono">{total}</span> / {totalAll} counties
          </span>
          {active > 0 ? (
            <button
              type="button"
              onClick={() => onChange({})}
              className="inline-flex items-center gap-1 text-xs uppercase tracking-wider hover:text-accent transition-colors"
            >
              <X size={11} aria-hidden />
              Clear {active}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function countActive(f: RankingFilters): number {
  let n = 0;
  if (f.region?.length) n += 1;
  if (f.rural !== undefined) n += 1;
  if (f.quintile?.length) n += 1;
  if (f.search) n += 1;
  if (f.populationMin !== undefined || f.populationMax !== undefined) n += 1;
  if (f.egiMin !== undefined || f.egiMax !== undefined) n += 1;
  return n;
}
