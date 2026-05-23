'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { WeightSliders, type Weights } from './WeightSliders';
import { RankChangeTable } from './RankChangeTable';
import { ChoroplethMap } from '@/components/map/ChoroplethMap';
import { ExportButton } from '@/components/ui/ExportButton';
import type { CountyRow, ReweightResponse } from '@/lib/types';
import { formatScore } from '@/lib/utils';

interface Props {
  initial: ReweightResponse;
}

const DEBOUNCE_MS = 150;

export function ReweightClient({ initial }: Props) {
  const [weights, setWeights] = useState<Weights>({ B: 33.333, C: 33.333, V: 33.334 });
  const [data, setData] = useState<ReweightResponse>(initial);
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setLoading(true);
      const total = weights.B + weights.C + weights.V;
      const b = weights.B / total;
      const c = weights.C / total;
      const v = weights.V / total;
      void fetch(`/api/reweight?b=${b.toFixed(4)}&c=${c.toFixed(4)}&v=${v.toFixed(4)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d: ReweightResponse) => setData(d))
        .catch((e) => {
          if (e?.name !== 'AbortError') console.error(e);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [weights]);

  // For the small choropleth, transform reweighted rows back into CountyRow shape
  // (lat/lon/quintile/etc. preserved from initial).
  const countyRowsByFips = useMemo(() => {
    const m = new Map<string, CountyRow>();
    for (const r of initial.rows) {
      m.set(r.fips, {
        fips: r.fips,
        county_name: r.county_name,
        region: r.region,
        population: r.population,
        burden_component: r.burden_component,
        capacity_component: r.capacity_component,
        vulnerability_component: r.vulnerability_component,
        egi_score: r.reweighted_score,
        egi_rank: r.reweighted_rank,
        egi_quintile: Math.min(5, Math.max(1, Math.ceil(r.reweighted_rank / 16.4))),
        is_delta: r.region === 'Delta' ? 1 : 0,
        is_rural: r.population < 50000 ? 1 : 0,
        latitude: null,
        longitude: null,
      });
    }
    return m;
  }, [initial.rows]);

  const liveRows: CountyRow[] = useMemo(
    () =>
      data.rows.map((r) => {
        const orig = countyRowsByFips.get(r.fips);
        return {
          ...(orig ?? ({} as CountyRow)),
          fips: r.fips,
          county_name: r.county_name,
          region: r.region,
          population: r.population,
          burden_component: r.burden_component,
          capacity_component: r.capacity_component,
          vulnerability_component: r.vulnerability_component,
          egi_score: r.reweighted_score,
          egi_rank: r.reweighted_rank,
          egi_quintile: Math.min(5, Math.max(1, Math.ceil(r.reweighted_rank / 16.4))),
          is_delta: r.region === 'Delta' ? 1 : 0,
          is_rural: r.population < 50000 ? 1 : 0,
          latitude: null,
          longitude: null,
        };
      }),
    [data.rows, countyRowsByFips],
  );

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Methodology stress test
        </div>
        <h1 className="font-display headline text-5xl mt-2">Reweight Lab.</h1>
        <p className="mt-3 max-w-prose text-muted-foreground leading-relaxed">
          Drag the sliders to retune the equal-thirds weighting. Sliders are sum-constrained to
          100 — moving one redistributes the change proportionally across the other two. The
          server runs a parameterized re-ranking against the read-only DB and returns it within
          ~200ms.
        </p>
      </header>

      <div className="grid md:grid-cols-12 gap-10 mt-8">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-32 space-y-8">
            <WeightSliders value={weights} onChange={setWeights} />
            <div className="border-t pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Headline finding
              </div>
              <div
                className={`border-l-2 pl-3 py-1.5 ${
                  data.issaquenaStillNumber1 ? 'border-success' : 'border-accent'
                }`}
              >
                <div className="flex items-start gap-2">
                  {data.issaquenaStillNumber1 ? (
                    <Check size={16} className="text-success mt-0.5" aria-hidden />
                  ) : (
                    <X size={16} className="text-accent mt-0.5" aria-hidden />
                  )}
                  <div className="text-sm leading-relaxed">
                    <div className="font-medium">
                      {data.issaquenaStillNumber1
                        ? 'Issaquena holds #1.'
                        : `${data.topCountyName} takes #1.`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Under {pct(weights.B)}/{pct(weights.C)}/{pct(weights.V)} weighting{' '}
                      (burden / capacity / vulnerability).
                    </div>
                  </div>
                </div>
              </div>
              {data.largestImprovement || data.largestRegression ? (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {data.largestImprovement ? (
                    <div>
                      Largest move up:{' '}
                      <a href={`/county/${data.largestImprovement.fips}`} className="text-foreground hover:text-accent">
                        {data.largestImprovement.county_name.replace(' County', '')}
                      </a>{' '}
                      <span className="text-success tabular">+{data.largestImprovement.rank_change}</span>
                    </div>
                  ) : null}
                  {data.largestRegression ? (
                    <div>
                      Largest move down:{' '}
                      <a href={`/county/${data.largestRegression.fips}`} className="text-foreground hover:text-accent">
                        {data.largestRegression.county_name.replace(' County', '')}
                      </a>{' '}
                      <span className="text-accent tabular">{data.largestRegression.rank_change}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="border-t pt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Map</div>
              <div className="h-[260px]">
                <ChoroplethMap rows={liveRows} height="100%" />
              </div>
            </div>
            <div>
              <ExportButton
                href={`/api/export/csv/reweight?b=${(weights.B / 100).toFixed(4)}&c=${(weights.C / 100).toFixed(4)}&v=${(weights.V / 100).toFixed(4)}`}
                filename="reweighted-ranking.csv"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Ranking</h2>
            <div className="text-2xs uppercase tracking-wider text-muted-foreground">
              Top 15 under current weights · {loading ? 'updating…' : 'live'}
            </div>
          </div>
          <div className={`mt-4 ${loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
            <RankChangeTable rows={data.rows} limit={15} />
          </div>
          <div className="mt-6 text-xs text-muted-foreground border-l-2 border-rule-strong pl-3 max-w-prose leading-relaxed">
            ↑ green means the county is now <em>more</em> underserved than baseline equal-thirds;{' '}
            ↓ red means less. Hover or click any county to drill in.
          </div>

          <details className="mt-8 border-t pt-5 text-sm">
            <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">
              The parameterized SQL behind this re-ranking
            </summary>
            <pre className="mt-3 font-mono text-2xs whitespace-pre-wrap bg-muted/40 p-3 border overflow-x-auto">
{`-- Inlined v_equity_gap_index CTE chain with parameterized weights:
WITH weights AS (
  SELECT CAST(? AS REAL) AS w_burden,
         CAST(? AS REAL) AS w_capacity,
         CAST(? AS REAL) AS w_vulnerability
), ... -- (full chain in src/lib/queries.ts:SQL_REWEIGHT)
SELECT ... , w_burden * burden + w_capacity * capacity + w_vulnerability * vulnerability AS reweighted_score
FROM combined ORDER BY reweighted_score DESC;`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}
