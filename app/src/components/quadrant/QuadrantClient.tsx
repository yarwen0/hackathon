'use client';

import { useMemo, useState } from 'react';
import { QuadrantScatter } from '@/components/charts/QuadrantScatter';
import { ExportButton } from '@/components/ui/ExportButton';
import { AuditTooltip } from '@/components/ui/AuditTooltip';
import type { QuadrantResponse, Region } from '@/lib/types';

const REGIONS: Region[] = ['Delta', 'Coastal', 'Pine Belt', 'Other'];

interface Props {
  data: QuadrantResponse;
}

export function QuadrantClient({ data }: Props) {
  const [regions, setRegions] = useState<Set<Region>>(new Set());
  const offDiagonal = useMemo(
    () => data.points.filter((p) => p.isOffDiagonal),
    [data.points],
  );
  const desoto = useMemo(() => data.points.find((p) => p.fips === '28033'), [data.points]);

  function toggle(r: Region) {
    setRegions((s) => {
      const next = new Set(s);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Two-axis structural backbone
        </div>
        <h1 className="font-display headline text-5xl mt-2">Quadrant Explorer.</h1>
        <p className="mt-3 max-w-prose text-muted-foreground leading-relaxed">
          Burden ↔ vulnerability is correlated <span className="font-mono tabular">r = 0.734</span>{' '}
          across the eighty-two MS counties — most counties stack the same direction. The
          analytically interesting counties are the <span className="text-foreground">off-diagonal ones</span>{' '}
          (outlined). Point size encodes population; color encodes capacity scarcity.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
        <span className="uppercase tracking-wider text-muted-foreground">Dim by region</span>
        <div className="flex gap-1">
          {REGIONS.map((r) => {
            const on = regions.has(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
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
        {regions.size > 0 ? (
          <button
            type="button"
            onClick={() => setRegions(new Set())}
            className="text-2xs uppercase tracking-wider text-muted-foreground hover:text-accent"
          >
            Clear
          </button>
        ) : null}
        <div className="ml-auto">
          <ExportButton href="/api/export/csv/quadrant" filename="quadrant.csv" />
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <QuadrantScatter points={data.points} stateMeans={data.stateMeans} selectedRegions={regions.size ? regions : null} />
      </div>

      <section className="mt-10 grid md:grid-cols-2 gap-10 pt-8 border-t">
        <div>
          <h2 className="font-display text-2xl">
            Off-diagonal counties{' '}
            <AuditTooltip metricId="burden_component" className="ml-1" />
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Counties where burden and vulnerability diverge by 5+ points either way. These are
            the ones that don&apos;t fit the dominant Delta pattern — they deserve targeted
            investigation.
          </p>
          {offDiagonal.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground italic">None at the current threshold.</div>
          ) : (
            <ul className="mt-4 divide-y border-t border-b">
              {offDiagonal.map((p) => {
                const hb = p.burden > data.stateMeans.burden;
                return (
                  <li key={p.fips} className="py-2.5 flex items-center justify-between gap-3">
                    <a
                      href={`/county/${p.fips}`}
                      className="font-display text-lg hover:text-accent transition-colors"
                    >
                      {p.county_name.replace(' County', '')}
                    </a>
                    <div className="text-xs text-muted-foreground tabular">
                      {p.region} · {hb ? 'high burden / low vulnerability' : 'low burden / high vulnerability'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl">DeSoto: the Delta outlier</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            DeSoto County (pop 186k, Memphis-suburban) sits in MDRA&apos;s Delta region for federal
            funding purposes but is functionally a metro-southern bedroom community. Its EGI looks
            nothing like the Delta hill counties — and this scatter makes that visible at a glance.
          </p>
          {desoto ? (
            <div className="mt-5 border-l-2 border-accent pl-4 py-2 text-sm">
              <div className="font-display text-3xl tabular">EGI {desoto.egi.toFixed(1)}</div>
              <div className="mt-1 text-muted-foreground text-xs tabular">
                burden {desoto.burden.toFixed(1)} · vulnerability {desoto.vulnerability.toFixed(1)} · capacity {desoto.capacity.toFixed(1)}
              </div>
              <div className="mt-2 text-2xs uppercase tracking-wider text-muted-foreground">
                State mean: burden {data.stateMeans.burden.toFixed(1)} · vulnerability {data.stateMeans.vulnerability.toFixed(1)}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
