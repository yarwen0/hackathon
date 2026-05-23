import { requireAuth } from '@/lib/auth';
import {
  getCompare,
  getCohort,
  getCounty,
  getQuadrant,
  getRanking,
  getReweight,
} from '@/lib/data';
import { parseCohortCriteria, parseRankingFilters } from '@/lib/filters';
import { csvResponse, rowsToCsv } from '@/lib/csv';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  await requireAuth();
  const { type } = await params;
  const url = new URL(req.url);

  switch (type) {
    case 'ranking': {
      const data = await getRanking(parseRankingFilters(url.searchParams));
      const csv = rowsToCsv(
        ['fips', 'county_name', 'region', 'population', 'is_rural', 'burden_component', 'capacity_component', 'vulnerability_component', 'egi_score', 'egi_rank', 'egi_quintile'],
        data.rows.map((r) => [r.fips, r.county_name, r.region, r.population, r.is_rural, r.burden_component, r.capacity_component, r.vulnerability_component, r.egi_score, r.egi_rank, r.egi_quintile]),
      );
      return csvResponse(csv, 'egi-ranking.csv');
    }
    case 'cohort': {
      const data = await getCohort(parseCohortCriteria(url.searchParams));
      const csv = rowsToCsv(
        ['fips', 'county_name', 'region', 'population', 'is_rural', 'burden_component', 'capacity_component', 'vulnerability_component', 'egi_score', 'egi_rank', 'egi_quintile'],
        data.rows.map((r) => [r.fips, r.county_name, r.region, r.population, r.is_rural, r.burden_component, r.capacity_component, r.vulnerability_component, r.egi_score, r.egi_rank, r.egi_quintile]),
      );
      return csvResponse(csv, 'egi-cohort.csv');
    }
    case 'county': {
      const fips = url.searchParams.get('fips');
      if (!fips) return new Response('fips required', { status: 400 });
      const data = await getCounty(fips);
      if (!data) return new Response('county not found', { status: 404 });
      const rows: Array<[string, string, string | number | null]> = [
        ['summary', 'egi_rank', data.county.egi_rank],
        ['summary', 'egi_score', data.county.egi_score],
        ['summary', 'egi_quintile', data.county.egi_quintile],
        ['summary', 'burden_component', data.county.burden_component],
        ['summary', 'capacity_component', data.county.capacity_component],
        ['summary', 'vulnerability_component', data.county.vulnerability_component],
        ['summary', 'population', data.county.population],
        ['summary', 'region', data.county.region],
        ['summary', 'is_rural', data.county.is_rural],
        ['providers', 'total_providers', data.totalProviders],
        ['providers', 'pcp_per_10k', data.providersPer10k.toFixed(3)],
      ];
      for (const t of data.providers) {
        rows.push(['provider_mix', t.taxonomy_label, t.provider_count]);
      }
      for (const d of data.drivers) {
        rows.push(['burden_driver', d.measure_short, d.value]);
        rows.push(['burden_driver_state_mean', d.measure_short, d.state_mean]);
      }
      const csv = rowsToCsv(['section', 'field', 'value'], rows);
      return csvResponse(csv, `${data.county.county_name.replace(/\s/g, '-')}-egi.csv`);
    }
    case 'compare': {
      const a = url.searchParams.get('a');
      const b = url.searchParams.get('b');
      if (!a || !b) return new Response('a and b required', { status: 400 });
      const data = await getCompare(a, b);
      if (!data) return new Response('not found', { status: 404 });
      const csv = rowsToCsv(
        ['group', 'metric', a, b, 'delta'],
        data.rows.map((r) => [r.group, r.label, r.a ?? '', r.b ?? '', r.a !== null && r.b !== null ? (r.a - r.b).toFixed(3) : '']),
      );
      return csvResponse(csv, `compare-${a}-${b}.csv`);
    }
    case 'quadrant': {
      const data = await getQuadrant();
      const csv = rowsToCsv(
        ['fips', 'county_name', 'region', 'population', 'burden', 'capacity', 'vulnerability', 'egi', 'off_diagonal'],
        data.points.map((p) => [p.fips, p.county_name, p.region, p.population, p.burden, p.capacity, p.vulnerability, p.egi, p.isOffDiagonal ? 1 : 0]),
      );
      return csvResponse(csv, 'egi-quadrant.csv');
    }
    case 'reweight': {
      const bn = Number.parseFloat(url.searchParams.get('b') ?? '0.333333');
      const cn = Number.parseFloat(url.searchParams.get('c') ?? '0.333333');
      const vn = Number.parseFloat(url.searchParams.get('v') ?? '0.333334');
      if (Math.abs(bn + cn + vn - 1) > 0.005) {
        return new Response('Weights must sum to 1.0', { status: 400 });
      }
      const data = await getReweight({ burden: bn, capacity: cn, vulnerability: vn });
      const csv = rowsToCsv(
        ['fips', 'county_name', 'region', 'population', 'burden_component', 'capacity_component', 'vulnerability_component', 'reweighted_score', 'reweighted_rank', 'baseline_rank', 'rank_change'],
        data.rows.map((r) => [r.fips, r.county_name, r.region, r.population, r.burden_component, r.capacity_component, r.vulnerability_component, r.reweighted_score, r.reweighted_rank, r.baseline_rank, r.rank_change]),
      );
      return csvResponse(csv, 'egi-reweighted.csv');
    }
    default:
      return new Response(`Unknown export type: ${type}`, { status: 400 });
  }
}
