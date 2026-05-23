// Bidirectional codec: URL ↔ filter state. Keys are sorted alphabetically when
// serializing so equivalent filter sets produce identical URLs (cache hits +
// stable share links).

import type { CohortCriteria, RankingFilters, Region } from './types';

const ALLOWED_REGIONS: Region[] = ['Delta', 'Coastal', 'Pine Belt', 'Other'];

function pickRegions(raw: string | null): Region[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Region => ALLOWED_REGIONS.includes(s as Region));
  return out.length ? out : undefined;
}

function pickInts(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  return out.length ? out : undefined;
}

function pickNumber(raw: string | null): number | undefined {
  if (raw == null) return undefined;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function pickBool(raw: string | null): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

export function parseRankingFilters(sp: URLSearchParams): RankingFilters {
  const f: RankingFilters = {};
  const region = pickRegions(sp.get('region'));
  if (region) f.region = region;
  const rural = pickBool(sp.get('rural'));
  if (rural !== undefined) f.rural = rural;
  const quintile = pickInts(sp.get('quintile'))?.filter((n) => n >= 1 && n <= 5);
  if (quintile && quintile.length) f.quintile = quintile;
  const popMin = pickNumber(sp.get('popMin'));
  if (popMin !== undefined) f.populationMin = popMin;
  const popMax = pickNumber(sp.get('popMax'));
  if (popMax !== undefined) f.populationMax = popMax;
  const egiMin = pickNumber(sp.get('egiMin'));
  if (egiMin !== undefined) f.egiMin = egiMin;
  const egiMax = pickNumber(sp.get('egiMax'));
  if (egiMax !== undefined) f.egiMax = egiMax;
  const search = sp.get('q');
  if (search) f.search = search;
  const sort = sp.get('sort');
  if (sort) f.sort = sort as RankingFilters['sort'];
  const dir = sp.get('dir');
  if (dir === 'asc' || dir === 'desc') f.dir = dir;
  return f;
}

export function serializeRankingFilters(f: RankingFilters): string {
  const sp = new URLSearchParams();
  if (f.region?.length) sp.set('region', [...f.region].sort().join(','));
  if (f.rural !== undefined) sp.set('rural', f.rural ? '1' : '0');
  if (f.quintile?.length) sp.set('quintile', [...f.quintile].sort((a, b) => a - b).join(','));
  if (f.populationMin !== undefined) sp.set('popMin', String(f.populationMin));
  if (f.populationMax !== undefined) sp.set('popMax', String(f.populationMax));
  if (f.egiMin !== undefined) sp.set('egiMin', String(f.egiMin));
  if (f.egiMax !== undefined) sp.set('egiMax', String(f.egiMax));
  if (f.search) sp.set('q', f.search);
  if (f.sort) sp.set('sort', f.sort);
  if (f.dir) sp.set('dir', f.dir);
  // Alphabetical key order for stable URLs.
  const sorted = new URLSearchParams();
  [...sp.keys()].sort().forEach((k) => sorted.set(k, sp.get(k)!));
  return sorted.toString();
}

export function parseCohortCriteria(sp: URLSearchParams): CohortCriteria {
  const c: CohortCriteria = {};
  const map: Array<[string, keyof CohortCriteria]> = [
    ['egiMin', 'egiMin'],
    ['egiMax', 'egiMax'],
    ['burdenMin', 'burdenMin'],
    ['burdenMax', 'burdenMax'],
    ['capacityMin', 'capacityMin'],
    ['capacityMax', 'capacityMax'],
    ['vulnMin', 'vulnerabilityMin'],
    ['vulnMax', 'vulnerabilityMax'],
    ['popMin', 'populationMin'],
    ['popMax', 'populationMax'],
    ['diaMin', 'diabetesMin'],
    ['obeMin', 'obesityMin'],
    ['uninMin', 'uninsuredMin'],
    ['fmMax', 'fmPer10kMax'],
  ];
  for (const [k, target] of map) {
    const n = pickNumber(sp.get(k));
    if (n !== undefined) (c as Record<string, unknown>)[target] = n;
  }
  const region = pickRegions(sp.get('region'));
  if (region) c.region = region;
  const rural = pickBool(sp.get('rural'));
  if (rural !== undefined) c.rural = rural;
  const quintile = pickInts(sp.get('quintile'))?.filter((n) => n >= 1 && n <= 5);
  if (quintile && quintile.length) c.quintile = quintile;
  return c;
}

export function serializeCohortCriteria(c: CohortCriteria): string {
  const sp = new URLSearchParams();
  const set = (key: string, v: number | undefined) => {
    if (v !== undefined) sp.set(key, String(v));
  };
  set('egiMin', c.egiMin);
  set('egiMax', c.egiMax);
  set('burdenMin', c.burdenMin);
  set('burdenMax', c.burdenMax);
  set('capacityMin', c.capacityMin);
  set('capacityMax', c.capacityMax);
  set('vulnMin', c.vulnerabilityMin);
  set('vulnMax', c.vulnerabilityMax);
  set('popMin', c.populationMin);
  set('popMax', c.populationMax);
  set('diaMin', c.diabetesMin);
  set('obeMin', c.obesityMin);
  set('uninMin', c.uninsuredMin);
  set('fmMax', c.fmPer10kMax);
  if (c.region?.length) sp.set('region', [...c.region].sort().join(','));
  if (c.rural !== undefined && c.rural !== null) sp.set('rural', c.rural ? '1' : '0');
  if (c.quintile?.length) sp.set('quintile', [...c.quintile].sort((a, b) => a - b).join(','));
  const sorted = new URLSearchParams();
  [...sp.keys()].sort().forEach((k) => sorted.set(k, sp.get(k)!));
  return sorted.toString();
}

export function isCohortEmpty(c: CohortCriteria): boolean {
  return serializeCohortCriteria(c) === '';
}
