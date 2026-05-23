import Link from 'next/link';
import { Edit3, ExternalLink } from 'lucide-react';
import { getCurrentUser, requireAuth } from '@/lib/auth';
import { getMethodologies } from '@/lib/methodologies';
import { MethodologyTable } from '@/components/methodology/MethodologyTable';
import { AuditTooltip } from '@/components/ui/AuditTooltip';

export const dynamic = 'force-dynamic';

export default async function MethodologyPage() {
  await requireAuth();
  const user = await getCurrentUser();
  const data = await getMethodologies();
  const isSteward = user?.role === 'methodology_steward';

  // Common-set highlight: counties appearing in all three top-10s.
  const inAll = new Set<string>();
  for (const c of data.rankings[0]!.top10) {
    if (data.rankings.every((r) => r.top10.some((t) => t.fips === c.fips))) {
      inAll.add(c.fips);
    }
  }

  return (
    <article className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Round 1 deliverable · transparency layer
        </div>
        <h1 className="font-display headline text-5xl mt-2">Methodology.</h1>
        <p className="mt-4 max-w-prose text-muted-foreground leading-relaxed">
          The Mississippi Health Equity Gap Index combines three independent federal datasets
          into a single 0–100 underservedness score per county. This page documents the
          weighting, the data provenance, and shows how the headline ranking holds under
          alternative methodological choices.
        </p>
      </header>

      <section className="mt-12 grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7">
          <h2 className="font-display text-3xl">What is the EGI?</h2>
          <div className="mt-4 max-w-prose space-y-4 text-base leading-relaxed">
            <p>
              The Equity Gap Index is a composite that asks one question: <em>where in
              Mississippi is the gap between health need and health resources largest?</em>
            </p>
            <p>
              It combines three independent pillars. <strong>Burden</strong>{' '}
              <AuditTooltip metricId="burden_component" /> is an average of ten chronic-disease and
              healthcare-access measures from CDC PLACES, each min-max normalized to 0–100 and
              polarity-adjusted. <strong>Capacity</strong>{' '}
              <AuditTooltip metricId="capacity_component" /> is primary-care providers per ten
              thousand residents (CMS NPPES + Census ACS) inverted so high = scarce. <strong>
              Vulnerability</strong> <AuditTooltip metricId="vulnerability_component" /> is the
              CDC/ATSDR Social Vulnerability Index 2022 overall percentile, intra-Mississippi.
            </p>
            <p>
              Equal thirds is the default weighting — same convention County Health Rankings
              uses (D-016). The next section shows that the headline ranking is{' '}
              <strong>robust to alternative weights</strong>.
            </p>
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="border-l-2 border-accent pl-4 py-2">
            <div className="text-xs uppercase tracking-wider text-accent">Headline finding</div>
            <p className="mt-2 text-sm leading-relaxed">{data.topCounty.summary}</p>
            <div className="mt-3 text-xs text-muted-foreground tabular">
              {data.topCounty.overlap} of 10 top counties appear in all three top-10 lists.
            </div>
          </div>
          <div className="mt-6 text-xs text-muted-foreground space-y-2">
            <div>
              View the original Round 1 SQL:{' '}
              <a
                href="https://github.com/yarwen0/hackathon"
                className="underline decoration-rule hover:decoration-accent inline-flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                sql/q05_equity_gap_index.sql <ExternalLink size={10} aria-hidden />
              </a>
            </div>
            <div>
              Statistical validation (bootstrap CIs, OLS, correlations) lives in
              python/03_statistical_analysis.py.
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 pt-12 border-t">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="font-display text-3xl">Methodology comparison</h2>
          <div className="text-xs text-muted-foreground tabular">
            PC1 explains {(data.pcaExplainedVarianceRatio * 100).toFixed(0)}% of variance
          </div>
        </div>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Three side-by-side top-10 leaderboards under different weighting schemes. Counties
          appearing in all three lists are shaded — that&apos;s the robust core of the ranking.
        </p>
        <div className="mt-8 grid md:grid-cols-3 gap-10">
          {data.rankings.map((r) => (
            <MethodologyTable key={r.id} ranking={r} highlight={inAll} />
          ))}
        </div>
      </section>

      <section className="mt-16 pt-12 border-t">
        <h2 className="font-display text-3xl">Data sources</h2>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Five federal datasets, each vintage-locked and reproducibly loaded by the Round 1
          pipeline.
        </p>
        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.dataSources.map((s) => (
            <div key={s.source_id} className="border-l-2 border-rule-strong pl-4 py-2">
              <div className="text-2xs uppercase tracking-wider text-accent">{s.publisher}</div>
              <div className="font-display text-lg mt-1">{s.dataset_name}</div>
              <dl className="mt-3 text-xs text-muted-foreground space-y-1.5">
                <div className="flex gap-2">
                  <dt className="uppercase tracking-wider w-20 shrink-0">Vintage</dt>
                  <dd>{s.vintage}</dd>
                </div>
                {s.release_date ? (
                  <div className="flex gap-2">
                    <dt className="uppercase tracking-wider w-20 shrink-0">Released</dt>
                    <dd className="tabular">{s.release_date}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt className="uppercase tracking-wider w-20 shrink-0">Retrieved</dt>
                  <dd className="tabular">{s.retrieval_date}</dd>
                </div>
                {s.rows_loaded !== null ? (
                  <div className="flex gap-2">
                    <dt className="uppercase tracking-wider w-20 shrink-0">Rows</dt>
                    <dd className="tabular">{Intl.NumberFormat('en-US').format(s.rows_loaded)}</dd>
                  </div>
                ) : null}
              </dl>
              {s.notes ? (
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{s.notes}</p>
              ) : null}
              <a
                href={s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs hover:text-accent transition-colors"
              >
                Source URL <ExternalLink size={10} aria-hidden />
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 pt-12 border-t">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="font-display text-3xl">Stewardship</h2>
          {isSteward ? (
            <Link
              href="/methodology/edit"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors"
            >
              <Edit3 size={11} aria-hidden /> Edit metadata
            </Link>
          ) : (
            <div className="text-2xs uppercase tracking-wider text-muted-foreground">
              Edit access: Methodology Steward role only
            </div>
          )}
        </div>
        <p className="mt-3 max-w-prose text-muted-foreground text-sm">
          Methodology stewards can update source descriptions, edit decision rationales, and mark
          methodologies as official vs experimental. Officers and external collaborators see
          everything but cannot modify metadata. This separation mirrors how the Gulf South
          Center governs analytical artifacts in production.
        </p>
      </section>

      <section className="mt-16 pt-12 border-t flex flex-wrap gap-6 text-xs text-muted-foreground">
        <a href="https://github.com/yarwen0/hackathon" target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
          GitHub: Round 1 source <ExternalLink size={10} aria-hidden />
        </a>
        <Link href="/" className="hover:text-foreground">Back to landing</Link>
        <Link href="/reweight" className="hover:text-foreground">Try alternative weights →</Link>
      </section>

    </article>
  );
}
