'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Link as LinkIcon, FileText } from 'lucide-react';
import { CohortFilterPanel } from '@/components/filters/CohortFilterPanel';
import { RankingTable } from '@/components/tables/RankingTable';
import { ChoroplethMap } from '@/components/map/ChoroplethMap';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import { AuditTooltip } from '@/components/ui/AuditTooltip';
import type {
  AuthUser,
  CohortCriteria,
  CohortResponse,
  CountyRow,
  RankingResponse,
} from '@/lib/types';
import { isCohortEmpty, parseCohortCriteria, serializeCohortCriteria } from '@/lib/filters';
import { formatInt, formatScore } from '@/lib/utils';

interface Props {
  initial: CohortResponse;
  initialCriteria: CohortCriteria;
  allCounties: RankingResponse;
  user: AuthUser;
  initialSavedToken?: string | null;
}

export function CohortClient({ initial, initialCriteria, allCounties, user, initialSavedToken }: Props) {
  const [criteria, setCriteria] = useState<CohortCriteria>(initialCriteria);
  const [data, setData] = useState<CohortResponse>(initial);
  const [hover, setHover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const populationBounds = useMemo(() => {
    if (allCounties.rows.length === 0) return { min: 0, max: 250000 };
    let min = Infinity;
    let max = -Infinity;
    for (const r of allCounties.rows) {
      if (r.population < min) min = r.population;
      if (r.population > max) max = r.population;
    }
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [allCounties.rows]);
  const [savedToken, setSavedToken] = useState<string | null>(initialSavedToken ?? null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState(false);

  const canSave = user.role === 'program_officer' || user.role === 'methodology_steward';

  useEffect(() => {
    const qs = serializeCohortCriteria(criteria);
    window.history.replaceState(null, '', qs ? `/cohort?${qs}` : '/cohort');
    setSavedToken(null);
    const ctrl = new AbortController();
    void fetch(`/api/cohort/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(criteria),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d: CohortResponse) => setData(d))
      .catch((e) => {
        if (e?.name !== 'AbortError') console.error(e);
      });
    return () => ctrl.abort();
  }, [criteria]);

  // Listen for popstate (back/forward).
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      setCriteria(parseCohortCriteria(sp));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const rows = data.rows;
  const stats = data.stats;
  const qs = useMemo(() => serializeCohortCriteria(criteria), [criteria]);

  async function saveCohort() {
    setSaving(true);
    try {
      const res = await fetch('/api/cohort/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ criteria }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const body = (await res.json()) as { token: string };
      setSavedToken(body.token);
      const url = `${window.location.origin}/cohort/${body.token}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareToast('Share link copied to clipboard');
      } catch {
        setShareToast(`Share URL: ${url}`);
      }
      setTimeout(() => setShareToast(null), 4000);
    } catch (err) {
      console.error(err);
      setShareToast('Save failed — check your role permissions.');
      setTimeout(() => setShareToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Funder-ready cohort builder
        </div>
        <h1 className="font-display headline text-5xl mt-2">Assemble a cohort.</h1>
        <p className="mt-3 max-w-prose text-muted-foreground leading-relaxed">
          Stack structural criteria — region, rurality, disease burden, provider scarcity, social
          vulnerability — to converge on a defensible multi-county target. Save the criteria as
          a share link or export the whole package as a PDF report.
        </p>
      </header>

      <div className="lg:hidden mt-4 sticky top-[57px] bg-background z-20 py-2 border-b">
        <button
          type="button"
          onClick={() => setOpenPanel((o) => !o)}
          className="text-xs uppercase tracking-wider border px-3 py-2 w-full"
        >
          {openPanel ? 'Hide criteria' : `Show ${rows.length}-county cohort filters`}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-10 mt-8">
        <div className={`lg:col-span-3 ${openPanel ? '' : 'hidden lg:block'}`}>
          <div className="lg:sticky lg:top-32">
            <CohortFilterPanel
              value={criteria}
              onChange={setCriteria}
              populationBounds={populationBounds}
            />
          </div>
        </div>

        <div className="lg:col-span-9 space-y-10">
          <section>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cohort</div>
                <div className="mt-1 font-display text-4xl tabular">
                  {rows.length}
                  <span className="text-base text-muted-foreground ml-2">of 82 counties</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSave ? (
                  <button
                    type="button"
                    onClick={saveCohort}
                    disabled={saving || isCohortEmpty(criteria) || rows.length === 0}
                    className="inline-flex items-center gap-1.5 border border-foreground px-3 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors"
                  >
                    {savedToken ? <LinkIcon size={12} aria-hidden /> : <Save size={12} aria-hidden />}
                    {saving ? 'Saving…' : savedToken ? 'Saved · share link copied' : 'Save & share'}
                  </button>
                ) : (
                  <div
                    className="text-2xs uppercase tracking-wider text-muted-foreground border border-dashed px-3 py-2"
                    title="External Collaborator role cannot save cohorts."
                  >
                    Read-only role
                  </div>
                )}
                <a
                  href={`/api/export/pdf/cohort?${qs}`}
                  className="inline-flex items-center gap-1.5 border border-foreground px-3 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={12} aria-hidden />
                  PDF report
                </a>
                <ExportButton href={`/api/export/csv/cohort?${qs}`} filename="cohort.csv" />
              </div>
            </div>
            {shareToast ? (
              <div className="mt-3 text-xs border-l-2 border-accent pl-3 py-1.5 text-foreground bg-accent/5">
                {shareToast}
              </div>
            ) : null}
          </section>

          <section className="grid md:grid-cols-4 gap-5 pt-5 border-t">
            <Stat label="Population" value={formatInt(stats.totalPopulation)} />
            <Stat
              label="Median EGI"
              value={rows.length ? formatScore(stats.medianEgi) : '—'}
              audit="egi_score"
            />
            <Stat label="Mean burden" value={rows.length ? formatScore(stats.meanBurden) : '—'} audit="burden_component" />
            <Stat
              label="PCP/10k (median)"
              value={rows.length ? stats.pcpPer10kMedian.toFixed(2) : '—'}
              audit="pcp_per_10k"
            />
          </section>

          {rows.length === 0 ? (
            <EmptyState
              title="No counties match these criteria."
              description="Loosen a slider or clear a regional filter to bring counties back."
              action={
                <button
                  type="button"
                  onClick={() => setCriteria({})}
                  className="border border-foreground px-4 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
                >
                  Reset criteria
                </button>
              }
            />
          ) : (
            <>
              <section className="grid md:grid-cols-12 gap-8">
                <div className="md:col-span-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Where the cohort sits
                  </div>
                  <div className="h-[320px] md:h-[420px]">
                    <ChoroplethMap
                      rows={rows}
                      highlightFips={hover}
                      onHover={setHover}
                      height="100%"
                      mode="shapes"
                    />
                  </div>
                  {stats.regionBreakdown.length > 0 ? (
                    <div className="mt-4 text-sm">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Region mix
                      </div>
                      <ul className="space-y-1">
                        {stats.regionBreakdown.map((r) => (
                          <li key={r.region} className="flex items-center gap-3">
                            <span className="text-foreground w-24">{r.region}</span>
                            <div className="flex-1 bar-track">
                              <div
                                className="bar-fill"
                                style={{
                                  width: `${(r.count / rows.length) * 100}%`,
                                  background: 'var(--foreground)',
                                }}
                              />
                            </div>
                            <span className="font-mono tabular w-8 text-right">{r.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="md:col-span-7">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Counties in cohort
                  </div>
                  <RankingTable
                    rows={rows}
                    sortKey="egi_rank"
                    sortDir="asc"
                    onSort={() => undefined}
                    highlightFips={hover}
                    onHover={setHover}
                  />
                </div>
              </section>

              {stats.topDrivers.length > 0 ? (
                <section>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    Top burden drivers across cohort
                  </div>
                  <ul className="grid md:grid-cols-3 gap-4">
                    {stats.topDrivers.map((d) => (
                      <li key={d.measure_short} className="border-l-2 border-accent pl-3 py-1">
                        <div className="font-display text-xl tabular">
                          {d.mean_value.toFixed(1)}%
                        </div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {d.measure_short}
                          <span className="text-2xs ml-2 normal-case tracking-normal">
                            state mean {d.state_mean.toFixed(1)}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          <section className="pt-6 border-t text-xs text-muted-foreground max-w-prose">
            <div>
              Cohort population is {((stats.totalPopulation / allCounties.stateStats.totalPopulation) * 100).toFixed(1)}% of Mississippi.
              Median EGI runs {formatScore(stats.medianEgi - allCounties.stateStats.meanEgi)} pts above the state mean.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, audit }: { label: string; value: string; audit?: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {label}
        {audit ? <AuditTooltip metricId={audit} /> : null}
      </div>
      <div className="font-mono tabular text-2xl mt-0.5">{value}</div>
    </div>
  );
}
