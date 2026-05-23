import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getCounty } from '@/lib/data';
import { ComponentBars } from '@/components/charts/ComponentBars';
import { BurdenDriversTable } from '@/components/charts/BurdenDriversTable';
import { ProviderBreakdown } from '@/components/charts/ProviderBreakdown';
import { SVIThemeBars } from '@/components/charts/SVIThemeBars';
import { QuintileBadge } from '@/components/ui/QuintileBadge';
import { AuditTooltip } from '@/components/ui/AuditTooltip';
import { ExportButton } from '@/components/ui/ExportButton';
import { formatInt, formatScore } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface Params {
  fips: string;
}

export default async function CountyPage({ params }: { params: Promise<Params> }) {
  await requireAuth();
  const { fips } = await params;
  const data = await getCounty(fips);
  if (!data) notFound();

  const { county, drivers, providers, totalProviders, providersPer10k, svi, interpretation, stateMeans } = data;

  return (
    <article className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={12} aria-hidden />
        Back to ranking
      </Link>

      <header className="mt-4 pb-8 border-b">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          County drilldown · FIPS {county.fips}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display headline text-5xl md:text-6xl leading-none">
            {county.county_name.replace(' County', '')}
          </h1>
          <div className="text-sm text-muted-foreground space-x-3 tabular">
            <span>{county.region} region</span>
            <span>·</span>
            <span>{county.is_rural ? 'Rural' : 'Urban'}</span>
            <span>·</span>
            <span>pop {formatInt(county.population)}</span>
          </div>
        </div>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foreground">
          {interpretation}
        </p>
      </header>

      <div className="mt-10 grid md:grid-cols-3 gap-6 pb-10 border-b">
        <StatCard
          label="EGI Rank"
          audit="egi_rank"
          value={`#${county.egi_rank}`}
          sub={`of 82 MS counties`}
        />
        <StatCard
          label="EGI Score"
          audit="egi_score"
          value={formatScore(county.egi_score)}
          sub={`state mean ${formatScore(stateMeans.egi)}`}
        />
        <StatCard
          label="Quintile"
          audit="egi_quintile"
          value={<QuintileBadge quintile={county.egi_quintile} size="md" />}
          sub={`${quintileWord(county.egi_quintile)} underserved`}
        />
      </div>

      <section className="mt-12 grid md:grid-cols-12 gap-12 pb-12 border-b">
        <div className="md:col-span-7">
          <h2 className="font-display text-2xl">Component breakdown</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            How the three independent pillars contribute to the composite. State-mean tick on each bar.
          </p>
          <div className="mt-6">
            <ComponentBars
              burden={county.burden_component}
              capacity={county.capacity_component}
              vulnerability={county.vulnerability_component}
              stateMeans={stateMeans}
            />
          </div>
        </div>
        <div className="md:col-span-5">
          <h2 className="font-display text-2xl">Social vulnerability</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            CDC/ATSDR SVI 2022, Mississippi state file. Percentiles are intra-MS only.
          </p>
          <div className="mt-6">
            <SVIThemeBars svi={svi} />
          </div>
        </div>
      </section>

      <section className="mt-12 grid md:grid-cols-12 gap-12 pb-12 border-b">
        <div className="md:col-span-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Top burden drivers</h2>
          </div>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            PLACES burden measures where this county most exceeds the state mean (polarity-adjusted).
          </p>
          <div className="mt-5">
            <BurdenDriversTable drivers={drivers} />
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Provider mix</h2>
            <div className="text-2xs uppercase tracking-wider text-muted-foreground tabular">
              {providersPer10k.toFixed(2)} / 10k
            </div>
          </div>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            CMS NPPES May 2026 + ACS 5-year. Six HRSA primary-care taxonomies.
          </p>
          <div className="mt-5">
            <ProviderBreakdown rows={providers} totalProviders={totalProviders} population={county.population} />
          </div>
        </div>
      </section>

      <section className="mt-12 flex flex-wrap items-center gap-4">
        <Link
          href={`/compare?a=${county.fips}`}
          className="inline-flex items-center gap-2 border border-foreground px-4 py-2.5 text-sm uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
        >
          Compare to another county
          <ArrowRight size={14} aria-hidden />
        </Link>
        <Link
          href={`/cohort?seed=${county.fips}`}
          className="inline-flex items-center gap-2 border border-foreground px-4 py-2.5 text-sm uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
        >
          Build a cohort from this county
          <ArrowRight size={14} aria-hidden />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ExportButton href={`/api/export/csv/county?fips=${county.fips}`} filename={`${county.county_name.replace(' ', '-')}-egi.csv`} />
          <ExportButton href={`/api/export/pdf/county/${county.fips}`} label="Export PDF" filename={`${county.county_name.replace(' ', '-')}-egi.pdf`} />
        </div>
      </section>
    </article>
  );
}

interface StatCardProps {
  label: string;
  audit: string;
  value: React.ReactNode;
  sub?: string;
}

function StatCard({ label, audit, value, sub }: StatCardProps) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">
        {label} <AuditTooltip metricId={audit} className="ml-1" />
      </div>
      <div className="mt-1 font-display text-4xl tabular">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </div>
  );
}

function quintileWord(q: number): string {
  switch (q) {
    case 1: return 'Most';
    case 2: return 'High';
    case 3: return 'Mid';
    case 4: return 'Low';
    case 5: return 'Least';
    default: return '';
  }
}
