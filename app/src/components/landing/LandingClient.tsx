'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterBar } from '@/components/filters/FilterBar';
import { RankingTable } from '@/components/tables/RankingTable';
import { ChoroplethMap } from '@/components/map/ChoroplethMap';
import { ExportButton } from '@/components/ui/ExportButton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CountyRow, RankingFilters, RankingResponse } from '@/lib/types';
import { parseRankingFilters, serializeRankingFilters } from '@/lib/filters';
import { AuditTooltip } from '@/components/ui/AuditTooltip';
import { formatInt, formatScore } from '@/lib/utils';

interface Props {
  initial: RankingResponse;
  initialFilters: RankingFilters;
}

export function LandingClient({ initial, initialFilters }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<RankingFilters>(initialFilters);
  const [data, setData] = useState<RankingResponse>(initial);
  const [hover, setHover] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Push filter changes to the URL (debounced) + refetch when relevant.
  useEffect(() => {
    const qs = serializeRankingFilters(filters);
    const target = qs ? `/?${qs}` : '/';
    window.history.replaceState(null, '', target);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void fetch(`/api/ranking${qs ? `?${qs}` : ''}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: RankingResponse) => {
        if (!ctrl.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') console.error(e);
      });
    return () => ctrl.abort();
  }, [filters]);

  // Listen for back/forward to keep state in sync.
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      setFilters(parseRankingFilters(sp));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const sortKey = filters.sort ?? 'egi_rank';
  const sortDir = filters.dir ?? (sortKey === 'egi_rank' ? 'asc' : 'desc');

  function onSort(key: keyof CountyRow) {
    setFilters((f) => {
      if (f.sort === key) {
        return { ...f, dir: f.dir === 'asc' ? 'desc' : 'asc' };
      }
      const nextDir: 'asc' | 'desc' = key === 'egi_rank' || key === 'county_name' ? 'asc' : 'desc';
      return { ...f, sort: key, dir: nextDir };
    });
  }

  const exportHref = useMemo(() => {
    const qs = serializeRankingFilters(filters);
    return `/api/export/csv/ranking${qs ? `?${qs}` : ''}`;
  }, [filters]);

  return (
    <div className="animate-fade-in">
      <header className="mx-auto max-w-content px-6 pt-12 pb-8 border-b">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Mississippi Health Equity Gap Index · 82 counties · CDC PLACES + NPPES + SVI
        </div>
        <h1 className="font-display headline text-5xl md:text-6xl mt-3 leading-tight">
          Where the gap is largest.
        </h1>
        <p className="mt-5 max-w-prose text-muted-foreground leading-relaxed">
          A single composite, three independent federal pillars. Filter the eighty-two MS counties
          by structural criteria, then click any county for the full audit trail.{' '}
          <a href="/methodology" className="underline decoration-rule hover:decoration-accent">
            How the score is built →
          </a>
        </p>
      </header>

      <FilterBar
        value={filters}
        onChange={setFilters}
        total={data.rows.length}
        totalAll={82}
      />

      <section className="mx-auto max-w-content px-6 py-6 grid gap-8 lg:grid-cols-12 animate-fade-up">
        <div className="lg:col-span-5 lg:sticky lg:top-32 lg:self-start lg:h-[calc(100vh-9rem)]">
          <ChoroplethMap
            rows={data.rows}
            highlightFips={hover}
            onHover={setHover}
            height="100%"
          />
          <div className="mt-3 text-xs text-muted-foreground">
            Click a county to drill in. Filter dims, never hides — every county stays on the map.
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Leaderboard
              <AuditTooltip metricId="egi_score" className="ml-1" />
            </div>
            <ExportButton href={exportHref} filename="egi-ranking.csv" />
          </div>

          {data.rows.length === 0 ? (
            <EmptyState
              title="No counties match these filters."
              description="Loosen one of the active filters to bring counties back."
              action={
                <button
                  type="button"
                  onClick={() => setFilters({})}
                  className="border border-foreground px-4 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <RankingTable
              rows={data.rows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              highlightFips={hover}
              onHover={setHover}
            />
          )}

          <div className="mt-8 pt-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Cohort population" value={formatInt(data.rows.reduce((s, r) => s + r.population, 0))} />
            <Stat
              label="Mean EGI"
              value={
                data.rows.length
                  ? formatScore(
                      data.rows.reduce((s, r) => s + r.egi_score, 0) / data.rows.length,
                    )
                  : '—'
              }
            />
            <Stat label="State mean EGI" value={formatScore(data.stateStats.meanEgi)} />
            <Stat label="State population" value={formatInt(data.stateStats.totalPopulation)} />
          </div>

          <div className="mt-8 text-xs text-muted-foreground border-l-2 border-rule-strong pl-4 max-w-prose leading-relaxed">
            Headline finding from Round 1 — Issaquena County (pop 1,206) ranks #1 with EGI 87.4,
            high on all three pillars simultaneously, and is independently a federally-designated
            Health Professional Shortage Area.{' '}
            <button
              type="button"
              onClick={() => router.push('/county/28055')}
              className="underline decoration-rule hover:decoration-accent inline"
            >
              See the Issaquena drilldown →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono tabular text-lg mt-0.5">{value}</div>
    </div>
  );
}
