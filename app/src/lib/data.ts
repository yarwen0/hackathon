// Cached read-only data accessors. These are imported by route handlers and
// RSCs alike, so the SQL is centralized and the response shapes are typed.

import { unstable_cache } from 'next/cache';
import { all, one } from './db';
import {
  SQL_BURDEN_DRIVERS,
  SQL_COUNTY_BY_FIPS,
  SQL_COUNTY_NAMES,
  SQL_DATA_SOURCES,
  SQL_PCP_PER_10K,
  SQL_PLACES_LATEST,
  SQL_PROVIDERS_BY_COUNTY,
  SQL_QUADRANT,
  SQL_RANKING_BASE,
  SQL_REWEIGHT,
  SQL_STATE_MEANS,
  SQL_SVI_BY_COUNTY,
  SQL_SVI_UNINSURED,
} from './queries';
import type {
  CohortCriteria,
  CohortResponse,
  CohortStats,
  CountyBurdenDriver,
  CountyProviderRow,
  CountyResponse,
  CountyRow,
  CountySVI,
  DataSource,
  QuadrantPoint,
  QuadrantResponse,
  RankingFilters,
  RankingResponse,
  Region,
  ReweightResponse,
  ReweightWeights,
} from './types';
import { mean, median } from './utils';

interface StateMeans {
  meanEgi: number;
  meanBurden: number;
  meanCapacity: number;
  meanVulnerability: number;
  totalPopulation: number;
  counties: number;
}

const stateMeansCache = unstable_cache(
  async (): Promise<StateMeans> => {
    return one<StateMeans>(SQL_STATE_MEANS)!;
  },
  ['state-means'],
  { revalidate: 3600, tags: ['ranking'] },
);

export async function getStateMeans(): Promise<StateMeans> {
  return stateMeansCache();
}

// ---------- Ranking ----------

function applyRankingFiltersJs(rows: CountyRow[], f: RankingFilters): CountyRow[] {
  let out = rows;
  if (f.region?.length) {
    const set = new Set(f.region);
    out = out.filter((r) => set.has(r.region));
  }
  if (f.rural !== undefined) {
    out = out.filter((r) => (f.rural ? r.is_rural === 1 : r.is_rural === 0));
  }
  if (f.quintile?.length) {
    const set = new Set(f.quintile);
    out = out.filter((r) => set.has(r.egi_quintile));
  }
  if (f.populationMin !== undefined) out = out.filter((r) => r.population >= f.populationMin!);
  if (f.populationMax !== undefined) out = out.filter((r) => r.population <= f.populationMax!);
  if (f.egiMin !== undefined) out = out.filter((r) => r.egi_score >= f.egiMin!);
  if (f.egiMax !== undefined) out = out.filter((r) => r.egi_score <= f.egiMax!);
  if (f.search) {
    const q = f.search.toLowerCase();
    out = out.filter((r) => r.county_name.toLowerCase().includes(q));
  }
  if (f.sort) {
    const dir = f.dir ?? 'asc';
    const sign = dir === 'asc' ? 1 : -1;
    const key = f.sort;
    out = [...out].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key];
      const bv = (b as unknown as Record<string, unknown>)[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }
  return out;
}

const baseRankingCache = unstable_cache(
  async (): Promise<CountyRow[]> => all<CountyRow>(SQL_RANKING_BASE + ' ORDER BY v.egi_rank ASC'),
  ['ranking-base'],
  { revalidate: 3600, tags: ['ranking'] },
);

export async function getRanking(filters: RankingFilters = {}): Promise<RankingResponse> {
  const base = await baseRankingCache();
  const stateStats = await getStateMeans();
  const rows = applyRankingFiltersJs(base, filters);
  return { rows, total: rows.length, appliedFilters: filters, stateStats };
}

// ---------- County drilldown ----------

const countyByFipsCache = (fips: string) =>
  unstable_cache(
    async (): Promise<CountyRow | undefined> => one<CountyRow>(SQL_COUNTY_BY_FIPS, [fips]),
    ['county-by-fips', fips],
    { revalidate: 3600, tags: ['ranking', `county-${fips}`] },
  )();

export async function getCounty(fips: string): Promise<CountyResponse | null> {
  const county = await countyByFipsCache(fips);
  if (!county) return null;
  const drivers = all<CountyBurdenDriver>(SQL_BURDEN_DRIVERS, [fips]);
  const providers = all<CountyProviderRow>(SQL_PROVIDERS_BY_COUNTY, [fips]);
  const svi = one<CountySVI>(SQL_SVI_BY_COUNTY, [fips])!;
  const totalProviders = providers.reduce((s, p) => s + p.provider_count, 0);
  const providersPer10k = county.population
    ? (totalProviders * 10000) / county.population
    : 0;
  const stateMeans = await getStateMeans();
  const interpretation = buildInterpretation(county, drivers, providers, totalProviders, stateMeans);
  return {
    county,
    drivers,
    providers,
    totalProviders,
    providersPer10k,
    svi,
    interpretation,
    stateMeans: {
      egi: stateMeans.meanEgi,
      burden: stateMeans.meanBurden,
      capacity: stateMeans.meanCapacity,
      vulnerability: stateMeans.meanVulnerability,
    },
  };
}

function buildInterpretation(
  county: CountyRow,
  drivers: CountyBurdenDriver[],
  providers: CountyProviderRow[],
  totalProviders: number,
  stateMeans: StateMeans,
): string {
  const partsAbove: string[] = [];
  if (county.burden_component > stateMeans.meanBurden + 5) partsAbove.push('disease burden');
  if (county.capacity_component > stateMeans.meanCapacity + 5) partsAbove.push('provider scarcity');
  if (county.vulnerability_component > stateMeans.meanVulnerability + 5)
    partsAbove.push('social vulnerability');

  const driver = drivers.slice(0, 1).map((d) => d.measure_short).join(', ');
  const zeroProvidersClause =
    totalProviders === 0
      ? ' It has zero county-attributed primary-care providers.'
      : providers.length && providers[0]!.provider_count === totalProviders
      ? ` Its provider mix is dominated by ${providers[0]!.taxonomy_label}.`
      : '';

  if (county.egi_rank === 1) {
    return `${county.county_name} ranks #1 on the EGI: most underserved overall, driven by ${
      partsAbove.length ? partsAbove.join(' + ') : 'a stacked profile across all three pillars'
    }${driver ? `, with ${driver} the leading burden driver` : ''}.${zeroProvidersClause}`;
  }

  if (partsAbove.length === 0) {
    return `${county.county_name} sits near the state median on all three EGI pillars (rank ${county.egi_rank}/82).`;
  }

  return `${county.county_name} is above the state mean on ${partsAbove.join(' and ')} (rank ${
    county.egi_rank
  }/82)${driver ? `, with ${driver} the leading burden driver` : ''}.${zeroProvidersClause}`;
}

// ---------- Compare ----------

import type { CompareResponse, CompareRow } from './types';

export async function getCompare(a: string, b: string): Promise<CompareResponse | null> {
  const ra = await getCounty(a);
  const rb = await getCounty(b);
  if (!ra || !rb) return null;

  const driversA = new Map(ra.drivers.map((d) => [d.measure_id, d]));
  const driversB = new Map(rb.drivers.map((d) => [d.measure_id, d]));
  const driverIds = Array.from(
    new Set([...ra.drivers.map((d) => d.measure_id), ...rb.drivers.map((d) => d.measure_id)]),
  );

  const rows: CompareRow[] = [];
  const push = (r: CompareRow) => rows.push(r);

  push({ id: 'rank', label: 'EGI Rank', group: 'Summary', a: ra.county.egi_rank, b: rb.county.egi_rank, unit: '', format: 'integer', higherIsWorse: true });
  push({ id: 'egi', label: 'EGI Score', group: 'Summary', a: ra.county.egi_score, b: rb.county.egi_score, unit: '', format: 'score', higherIsWorse: true });
  push({ id: 'quintile', label: 'Quintile', group: 'Summary', a: ra.county.egi_quintile, b: rb.county.egi_quintile, unit: '', format: 'integer', higherIsWorse: true });
  push({ id: 'pop', label: 'Population', group: 'Summary', a: ra.county.population, b: rb.county.population, unit: 'people', format: 'integer', higherIsWorse: false });

  push({ id: 'burden', label: 'Burden component', group: 'Components', a: ra.county.burden_component, b: rb.county.burden_component, unit: '', format: 'score', higherIsWorse: true });
  push({ id: 'capacity', label: 'Capacity component', group: 'Components', a: ra.county.capacity_component, b: rb.county.capacity_component, unit: '', format: 'score', higherIsWorse: true });
  push({ id: 'vuln', label: 'Vulnerability component', group: 'Components', a: ra.county.vulnerability_component, b: rb.county.vulnerability_component, unit: '', format: 'score', higherIsWorse: true });

  push({ id: 'rpl', label: 'SVI overall (intra-MS pctl)', group: 'SVI Themes', a: ra.svi.rpl_themes !== null ? ra.svi.rpl_themes * 100 : null, b: rb.svi.rpl_themes !== null ? rb.svi.rpl_themes * 100 : null, unit: '', format: 'percent', higherIsWorse: true });
  push({ id: 'rpl1', label: 'Socioeconomic Status (Theme 1)', group: 'SVI Themes', a: ra.svi.rpl_theme1_socioeconomic !== null ? ra.svi.rpl_theme1_socioeconomic * 100 : null, b: rb.svi.rpl_theme1_socioeconomic !== null ? rb.svi.rpl_theme1_socioeconomic * 100 : null, unit: '', format: 'percent', higherIsWorse: true });
  push({ id: 'rpl2', label: 'Household Characteristics (Theme 2)', group: 'SVI Themes', a: ra.svi.rpl_theme2_household !== null ? ra.svi.rpl_theme2_household * 100 : null, b: rb.svi.rpl_theme2_household !== null ? rb.svi.rpl_theme2_household * 100 : null, unit: '', format: 'percent', higherIsWorse: true });
  push({ id: 'rpl3', label: 'Racial & Ethnic Minority (Theme 3)', group: 'SVI Themes', a: ra.svi.rpl_theme3_minority !== null ? ra.svi.rpl_theme3_minority * 100 : null, b: rb.svi.rpl_theme3_minority !== null ? rb.svi.rpl_theme3_minority * 100 : null, unit: '', format: 'percent', higherIsWorse: true });
  push({ id: 'rpl4', label: 'Housing & Transport (Theme 4)', group: 'SVI Themes', a: ra.svi.rpl_theme4_housing_transport !== null ? ra.svi.rpl_theme4_housing_transport * 100 : null, b: rb.svi.rpl_theme4_housing_transport !== null ? rb.svi.rpl_theme4_housing_transport * 100 : null, unit: '', format: 'percent', higherIsWorse: true });

  push({ id: 'totalP', label: 'Primary-care providers', group: 'Providers', a: ra.totalProviders, b: rb.totalProviders, unit: 'people', format: 'integer', higherIsWorse: false });
  push({ id: 'pcp10k', label: 'PCP per 10,000 residents', group: 'Providers', a: ra.providersPer10k, b: rb.providersPer10k, unit: 'per 10k', format: 'decimal', higherIsWorse: false });

  for (const id of driverIds) {
    const da = driversA.get(id);
    const db = driversB.get(id);
    const label = (da ?? db)!.measure_short;
    push({
      id: `drv-${id}`,
      label,
      group: 'Burden Drivers',
      a: da?.value ?? null,
      b: db?.value ?? null,
      unit: '%',
      format: 'percent',
      higherIsWorse: (da ?? db)!.polarity === 1,
    });
  }

  return { a: ra.county, b: rb.county, rows };
}

// ---------- Cohort ----------

interface CohortAuxRow {
  fips: string;
  pcp_per_10k: number;
  fm_per_10k: number;
  diabetes?: number;
  obesity?: number;
  uninsured?: number;
  access2?: number;
  ep_uninsur?: number;
}

const cohortAuxCache = unstable_cache(
  async (): Promise<Record<string, CohortAuxRow>> => {
    const pcp = all<{ fips: string; pcp_per_10k: number; fm_per_10k: number }>(SQL_PCP_PER_10K);
    const places = all<{ fips: string; measure_id: string; value: number }>(SQL_PLACES_LATEST);
    const svi = all<{ fips: string; ep_uninsur: number | null }>(SQL_SVI_UNINSURED);
    const map: Record<string, CohortAuxRow> = {};
    for (const r of pcp) {
      map[r.fips] = { fips: r.fips, pcp_per_10k: r.pcp_per_10k, fm_per_10k: r.fm_per_10k };
    }
    for (const r of places) {
      const k = map[r.fips] ??= { fips: r.fips, pcp_per_10k: 0, fm_per_10k: 0 };
      if (r.measure_id === 'DIABETES') k.diabetes = r.value;
      else if (r.measure_id === 'OBESITY') k.obesity = r.value;
      else if (r.measure_id === 'ACCESS2') k.access2 = r.value;
    }
    for (const r of svi) {
      const k = map[r.fips] ??= { fips: r.fips, pcp_per_10k: 0, fm_per_10k: 0 };
      k.uninsured = r.ep_uninsur ?? undefined;
    }
    return map;
  },
  ['cohort-aux'],
  { revalidate: 3600, tags: ['cohort-aux'] },
);

export async function getCohort(c: CohortCriteria): Promise<CohortResponse> {
  const all_rows = (await baseRankingCache()).slice();
  const aux = await cohortAuxCache();
  const filtered = all_rows.filter((row) => {
    if (c.egiMin !== undefined && row.egi_score < c.egiMin) return false;
    if (c.egiMax !== undefined && row.egi_score > c.egiMax) return false;
    if (c.burdenMin !== undefined && row.burden_component < c.burdenMin) return false;
    if (c.burdenMax !== undefined && row.burden_component > c.burdenMax) return false;
    if (c.capacityMin !== undefined && row.capacity_component < c.capacityMin) return false;
    if (c.capacityMax !== undefined && row.capacity_component > c.capacityMax) return false;
    if (c.vulnerabilityMin !== undefined && row.vulnerability_component < c.vulnerabilityMin) return false;
    if (c.vulnerabilityMax !== undefined && row.vulnerability_component > c.vulnerabilityMax) return false;
    if (c.populationMin !== undefined && row.population < c.populationMin) return false;
    if (c.populationMax !== undefined && row.population > c.populationMax) return false;
    if (c.region?.length && !c.region.includes(row.region)) return false;
    if (c.rural === true && row.is_rural !== 1) return false;
    if (c.rural === false && row.is_rural !== 0) return false;
    if (c.quintile?.length && !c.quintile.includes(row.egi_quintile)) return false;
    const a = aux[row.fips];
    if (!a) return false;
    if (c.diabetesMin !== undefined && (a.diabetes ?? -Infinity) < c.diabetesMin) return false;
    if (c.obesityMin !== undefined && (a.obesity ?? -Infinity) < c.obesityMin) return false;
    if (c.uninsuredMin !== undefined && (a.uninsured ?? -Infinity) < c.uninsuredMin) return false;
    if (c.fmPer10kMax !== undefined && a.fm_per_10k > c.fmPer10kMax) return false;
    return true;
  });
  const drivers = all<{ measure_short: string; mean_value: number; state_mean: number }>(
    /* sql */ `
    WITH latest AS (
      SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id
    ),
    state_means AS (
      SELECT m.measure_id, AVG(hi.data_value) AS state_mean
      FROM health_indicators hi
      JOIN measures m USING (measure_id)
      JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
      WHERE hi.data_value_type = 'Age-adjusted prevalence'
        AND m.is_in_burden_composite = 1
      GROUP BY m.measure_id
    )
    SELECT
      m.measure_short,
      AVG(hi.data_value) AS mean_value,
      sm.state_mean
    FROM health_indicators hi
    JOIN measures m USING (measure_id)
    JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
    JOIN state_means sm USING (measure_id)
    WHERE hi.data_value_type = 'Age-adjusted prevalence'
      AND m.is_in_burden_composite = 1
      AND hi.fips IN (${filtered.length ? filtered.map(() => '?').join(',') : 'NULL'})
    GROUP BY m.measure_id, m.measure_short, sm.state_mean
    ORDER BY (m.polarity * (AVG(hi.data_value) - sm.state_mean)) DESC
    LIMIT 3
    `,
    filtered.map((r) => r.fips),
  );

  const regionMap = new Map<Region, number>();
  for (const row of filtered) {
    regionMap.set(row.region, (regionMap.get(row.region) ?? 0) + 1);
  }
  const regionBreakdown = Array.from(regionMap.entries()).map(([region, count]) => ({
    region,
    count,
  }));

  const stats: CohortStats = {
    countyCount: filtered.length,
    totalPopulation: filtered.reduce((s, r) => s + r.population, 0),
    meanEgi: mean(filtered.map((r) => r.egi_score)),
    medianEgi: median(filtered.map((r) => r.egi_score)),
    meanBurden: mean(filtered.map((r) => r.burden_component)),
    meanCapacity: mean(filtered.map((r) => r.capacity_component)),
    meanVulnerability: mean(filtered.map((r) => r.vulnerability_component)),
    pcpPer10kMedian: median(filtered.map((r) => aux[r.fips]?.pcp_per_10k ?? 0)),
    uninsuredMedian: median(filtered.map((r) => aux[r.fips]?.uninsured ?? 0)),
    topDrivers: drivers,
    regionBreakdown,
  };
  return { rows: filtered, stats, criteria: c };
}

// ---------- Quadrant ----------

export async function getQuadrant(): Promise<QuadrantResponse> {
  const rows = all<CountyRow>(SQL_QUADRANT);
  const stateMeans = await getStateMeans();
  const points: QuadrantPoint[] = rows.map((r) => {
    const isOff =
      (r.burden_component > stateMeans.meanBurden + 5 &&
        r.vulnerability_component < stateMeans.meanVulnerability - 5) ||
      (r.burden_component < stateMeans.meanBurden - 5 &&
        r.vulnerability_component > stateMeans.meanVulnerability + 5);
    return {
      fips: r.fips,
      county_name: r.county_name,
      region: r.region,
      burden: r.burden_component,
      vulnerability: r.vulnerability_component,
      capacity: r.capacity_component,
      population: r.population,
      egi: r.egi_score,
      isOffDiagonal: isOff,
    };
  });
  return {
    points,
    stateMeans: {
      burden: stateMeans.meanBurden,
      vulnerability: stateMeans.meanVulnerability,
      capacity: stateMeans.meanCapacity,
    },
  };
}

// ---------- Reweight ----------

interface ReweightDbRow extends Omit<CountyRow, 'egi_score' | 'egi_rank' | 'egi_quintile' | 'is_delta' | 'is_rural' | 'latitude' | 'longitude'> {
  reweighted_score: number;
  reweighted_rank: number;
}

export async function getReweight(weights: ReweightWeights): Promise<ReweightResponse> {
  const sum = weights.burden + weights.capacity + weights.vulnerability;
  if (Math.abs(sum - 1) > 0.005) {
    throw new Error(`Weights must sum to 1.0 (got ${sum.toFixed(3)})`);
  }
  const baseline = await baseRankingCache();
  const baselineRanks = new Map(baseline.map((r) => [r.fips, r.egi_rank]));
  const raw = all<ReweightDbRow>(SQL_REWEIGHT, [
    weights.burden,
    weights.capacity,
    weights.vulnerability,
  ]);
  const rows = raw.map((r) => {
    const baseRank = baselineRanks.get(r.fips) ?? 0;
    return {
      ...r,
      baseline_rank: baseRank,
      rank_change: baseRank - r.reweighted_rank,
    };
  });
  const topRow = rows[0]!;
  const issaquena = rows.find((r) => r.fips === '28055');
  const improvements = [...rows].sort((a, b) => b.rank_change - a.rank_change);
  const regressions = [...rows].sort((a, b) => a.rank_change - b.rank_change);
  return {
    rows,
    weights,
    topCountyName: topRow.county_name,
    issaquenaStillNumber1: issaquena?.reweighted_rank === 1,
    largestImprovement: improvements[0] && improvements[0].rank_change > 0
      ? {
          fips: improvements[0].fips,
          county_name: improvements[0].county_name,
          rank_change: improvements[0].rank_change,
        }
      : null,
    largestRegression: regressions[0] && regressions[0].rank_change < 0
      ? {
          fips: regressions[0].fips,
          county_name: regressions[0].county_name,
          rank_change: regressions[0].rank_change,
        }
      : null,
  };
}

// ---------- Methodologies ----------

const dataSourcesCache = unstable_cache(
  async (): Promise<DataSource[]> => all<DataSource>(SQL_DATA_SOURCES),
  ['data-sources'],
  { revalidate: 3600 },
);

export async function getDataSources(): Promise<DataSource[]> {
  return dataSourcesCache();
}

// ---------- County names directory (used by Compare dropdown) ----------

const countyDirCache = unstable_cache(
  async () => all<{ fips: string; county_name: string }>(SQL_COUNTY_NAMES),
  ['county-dir'],
  { revalidate: 86400 },
);

export async function getCountyDirectory() {
  return countyDirCache();
}
