'use client';

import { RotateCcw } from 'lucide-react';
import { RangeSlider } from './RangeSlider';
import type { CohortCriteria, Region } from '@/lib/types';
import { formatInt } from '@/lib/utils';

const REGIONS: Region[] = ['Delta', 'Coastal', 'Pine Belt', 'Other'];

interface Props {
  value: CohortCriteria;
  onChange: (next: CohortCriteria) => void;
  populationBounds?: { min: number; max: number };
}

export function CohortFilterPanel({ value, onChange, populationBounds }: Props) {
  const popMin = populationBounds?.min ?? 1000;
  const popMax = populationBounds?.max ?? 250000;
  const isActive = Object.values(value).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null,
  );

  return (
    <aside className="text-sm">
      <div className="flex items-center justify-between border-b pb-3 mb-5">
        <h2 className="font-display text-xl">Cohort criteria</h2>
        {isActive ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-accent transition-colors"
          >
            <RotateCcw size={11} aria-hidden /> Reset
          </button>
        ) : null}
      </div>

      <div className="space-y-7">
        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Composite</div>
          <div className="space-y-5">
            <RangeSlider
              label="EGI score"
              min={0}
              max={100}
              step={1}
              valueMin={value.egiMin}
              valueMax={value.egiMax}
              onChange={(min, max) => onChange({ ...value, egiMin: min, egiMax: max })}
            />
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Components</div>
          <div className="space-y-5">
            <RangeSlider
              label="Burden"
              min={0}
              max={100}
              step={1}
              valueMin={value.burdenMin}
              valueMax={value.burdenMax}
              onChange={(min, max) => onChange({ ...value, burdenMin: min, burdenMax: max })}
            />
            <RangeSlider
              label="Capacity"
              min={0}
              max={100}
              step={1}
              valueMin={value.capacityMin}
              valueMax={value.capacityMax}
              onChange={(min, max) => onChange({ ...value, capacityMin: min, capacityMax: max })}
            />
            <RangeSlider
              label="Vulnerability"
              min={0}
              max={100}
              step={1}
              valueMin={value.vulnerabilityMin}
              valueMax={value.vulnerabilityMax}
              onChange={(min, max) => onChange({ ...value, vulnerabilityMin: min, vulnerabilityMax: max })}
            />
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Geography</div>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r) => {
              const on = value.region?.includes(r) ?? false;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    const set = new Set(value.region ?? []);
                    if (set.has(r)) set.delete(r);
                    else set.add(r);
                    onChange({ ...value, region: set.size ? Array.from(set) : undefined });
                  }}
                  aria-pressed={on}
                  className={`border px-2.5 py-1 text-2xs uppercase tracking-wider transition-colors ${
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
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Rurality</span>
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, rural: value.rural === true ? null : true })
              }
              className={`border px-2.5 py-1 text-2xs uppercase tracking-wider transition-colors ${
                value.rural === true
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-rule-strong text-muted-foreground hover:text-foreground'
              }`}
            >
              Rural only
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, rural: value.rural === false ? null : false })
              }
              className={`border px-2.5 py-1 text-2xs uppercase tracking-wider transition-colors ${
                value.rural === false
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-rule-strong text-muted-foreground hover:text-foreground'
              }`}
            >
              Urban only
            </button>
          </div>
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Population</div>
          <RangeSlider
            label="Range"
            min={popMin}
            max={popMax}
            step={Math.max(1, Math.round((popMax - popMin) / 200))}
            valueMin={value.populationMin}
            valueMax={value.populationMax}
            format={formatInt}
            onChange={(min, max) => onChange({ ...value, populationMin: min, populationMax: max })}
          />
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Quintile</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((q) => {
              const on = value.quintile?.includes(q) ?? false;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    const set = new Set(value.quintile ?? []);
                    if (set.has(q)) set.delete(q);
                    else set.add(q);
                    onChange({ ...value, quintile: set.size ? Array.from(set) : undefined });
                  }}
                  aria-pressed={on}
                  className={`flex-1 border py-1 text-2xs tabular transition-colors ${
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
        </section>

        <section>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Burden thresholds
          </div>
          <div className="space-y-5">
            <RangeSlider
              label="Diabetes ≥"
              min={5}
              max={20}
              step={0.5}
              valueMin={value.diabetesMin}
              valueMax={undefined}
              format={(n) => `${n.toFixed(1)}%`}
              onChange={(min) => onChange({ ...value, diabetesMin: min })}
            />
            <RangeSlider
              label="Obesity ≥"
              min={30}
              max={55}
              step={0.5}
              valueMin={value.obesityMin}
              valueMax={undefined}
              format={(n) => `${n.toFixed(1)}%`}
              onChange={(min) => onChange({ ...value, obesityMin: min })}
            />
            <RangeSlider
              label="Uninsured ≥"
              min={5}
              max={30}
              step={0.5}
              valueMin={value.uninsuredMin}
              valueMax={undefined}
              format={(n) => `${n.toFixed(1)}%`}
              onChange={(min) => onChange({ ...value, uninsuredMin: min })}
            />
            <RangeSlider
              label="FM per 10k ≤"
              min={0}
              max={15}
              step={0.5}
              valueMin={undefined}
              valueMax={value.fmPer10kMax}
              format={(n) => n.toFixed(1)}
              onChange={(_min, max) => onChange({ ...value, fmPer10kMax: max })}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
