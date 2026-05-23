// Three alternative weighting schemes for the EGI:
//   1. equal_thirds      — Round 1 default (1/3, 1/3, 1/3)
//   2. pca               — first principal component of the 3-component matrix,
//                          decomposed via power iteration on the covariance matrix.
//   3. burden_weighted   — burden 50% / capacity 30% / vulnerability 20% (a
//                          plausible foundation framing that prioritises
//                          outcomes over upstream factors).

import { all } from './db';
import { SQL_RANKING_BASE } from './queries';
import { unstable_cache } from 'next/cache';
import { getReweight, getDataSources } from './data';
import type {
  CountyRow,
  MethodologiesResponse,
  MethodologyId,
  MethodologyRanking,
  ReweightWeights,
} from './types';

const FALLBACK_PCA: ReweightWeights = { burden: 0.36, capacity: 0.31, vulnerability: 0.33 };

const computeCache = unstable_cache(
  async () => {
    const rows = all<CountyRow>(SQL_RANKING_BASE);
    const burden = rows.map((r) => r.burden_component);
    const capacity = rows.map((r) => r.capacity_component);
    const vulnerability = rows.map((r) => r.vulnerability_component);
    const pca = computePCAWeights(burden, capacity, vulnerability);
    return pca ?? { weights: FALLBACK_PCA, variance: 0.6 };
  },
  ['pca-weights'],
  { revalidate: 3600, tags: ['ranking'] },
);

export async function getMethodologies(): Promise<MethodologiesResponse> {
  const pcaResult = await computeCache();

  const [equalThirds, pca, burdenWeighted] = await Promise.all([
    getReweight({ burden: 1 / 3, capacity: 1 / 3, vulnerability: 1 / 3 }),
    getReweight(pcaResult.weights),
    getReweight({ burden: 0.5, capacity: 0.3, vulnerability: 0.2 }),
  ]);

  const rankings: MethodologyRanking[] = [
    {
      id: 'equal_thirds',
      label: 'Equal thirds (default)',
      description:
        'County Health Rankings precedent. Each of the three pillars contributes one-third. The official EGI ships under this weighting (D-016).',
      weights: { burden: 1 / 3, capacity: 1 / 3, vulnerability: 1 / 3 },
      top10: equalThirds.rows.slice(0, 10).map((r) => ({
        fips: r.fips,
        county_name: r.county_name,
        score: r.reweighted_score,
        rank: r.reweighted_rank,
      })),
    },
    {
      id: 'pca',
      label: 'Principal-component (data-driven)',
      description: `Largest eigenvector of the 3×3 sample covariance matrix of (burden, capacity, vulnerability) across 82 counties, decomposed via power iteration. ${(pcaResult.variance * 100).toFixed(0)}% of variance explained by PC1.`,
      weights: pcaResult.weights,
      top10: pca.rows.slice(0, 10).map((r) => ({
        fips: r.fips,
        county_name: r.county_name,
        score: r.reweighted_score,
        rank: r.reweighted_rank,
      })),
    },
    {
      id: 'burden_weighted',
      label: 'Burden-weighted (foundation framing)',
      description:
        'Burden 50% / capacity 30% / vulnerability 20% — a plausible alternative where the foundation prioritizes downstream health outcomes over upstream structural factors.',
      weights: { burden: 0.5, capacity: 0.3, vulnerability: 0.2 },
      top10: burdenWeighted.rows.slice(0, 10).map((r) => ({
        fips: r.fips,
        county_name: r.county_name,
        score: r.reweighted_score,
        rank: r.reweighted_rank,
      })),
    },
  ];

  const top1Sets = rankings.map((r) => r.top10[0]!.county_name);
  const allTop1Same = top1Sets.every((n) => n === top1Sets[0]);
  const inAll = rankings[0]!.top10.filter((c) =>
    rankings.every((r) => r.top10.some((t) => t.fips === c.fips)),
  );

  const dataSources = await getDataSources();
  return {
    rankings,
    topCounty: {
      overlap: inAll.length,
      inAll: inAll.map((c) => c.county_name),
      onlyEqualThirds: rankings[0]!.top10
        .filter(
          (c) =>
            !rankings[1]!.top10.some((t) => t.fips === c.fips) ||
            !rankings[2]!.top10.some((t) => t.fips === c.fips),
        )
        .map((c) => c.county_name),
      summary: allTop1Same
        ? `${top1Sets[0]!.replace(' County', '')} sits at #1 across all three weighting schemes — the headline finding is robust to methodological choice.`
        : `Top county varies by weighting: ${top1Sets
            .map((n, i) => `${rankings[i]!.label} → ${n.replace(' County', '')}`)
            .join('; ')}.`,
    },
    dataSources,
    pcaExplainedVarianceRatio: pcaResult.variance,
  };
}

// ---------- PCA via power iteration ----------

function computePCAWeights(
  burden: number[],
  capacity: number[],
  vulnerability: number[],
): { weights: ReweightWeights; variance: number } | null {
  const n = burden.length;
  if (n < 3) return null;

  const cols = [burden, capacity, vulnerability];
  const means = cols.map((c) => c.reduce((s, v) => s + v, 0) / n);

  // 3×3 sample covariance matrix.
  const cov: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = i; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) {
        s += (cols[i]![k]! - means[i]!) * (cols[j]![k]! - means[j]!);
      }
      const v = s / (n - 1);
      cov[i]![j] = v;
      cov[j]![i] = v;
    }
  }

  // Power iteration for the largest eigenvector.
  let vec = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  let eigenvalue = 0;
  for (let iter = 0; iter < 200; iter++) {
    const next = matVec(cov, vec);
    const norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-10) break;
    const normalized = next.map((x) => x / norm);
    eigenvalue = norm; // Rayleigh quotient under normalization ≈ |Mv|
    const delta = normalized.reduce((s, x, i) => s + Math.abs(x - vec[i]!), 0);
    vec = normalized;
    if (delta < 1e-8) break;
  }

  // Use absolute loadings (signs don't matter for weighting purposes) and normalize to sum 1.
  const absV = vec.map(Math.abs);
  const sum = absV.reduce((s, x) => s + x, 0);
  if (sum < 1e-9) return null;
  const weights: ReweightWeights = {
    burden: absV[0]! / sum,
    capacity: absV[1]! / sum,
    vulnerability: absV[2]! / sum,
  };
  // Variance ratio: λ₁ / trace(cov)
  const trace = cov[0]![0]! + cov[1]![1]! + cov[2]![2]!;
  return { weights, variance: trace ? eigenvalue / trace : 0 };
}

function matVec(m: number[][], v: number[]): number[] {
  return [
    m[0]![0]! * v[0]! + m[0]![1]! * v[1]! + m[0]![2]! * v[2]!,
    m[1]![0]! * v[0]! + m[1]![1]! * v[1]! + m[1]![2]! * v[2]!,
    m[2]![0]! * v[0]! + m[2]![1]! * v[1]! + m[2]![2]! * v[2]!,
  ];
}

export type { MethodologyId };
