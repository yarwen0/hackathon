// Audit map: every UI-surfaced metric maps to a source, a Round-1 decision,
// and (where applicable) a SQL snippet. The <AuditTooltip> reads from here.

import type { AuditEntry } from './types';

const ENTRIES: Record<string, AuditEntry> = {
  egi_score: {
    metricId: 'egi_score',
    label: 'EGI Score',
    description:
      '0–100 composite. Higher = more underserved. Equal-thirds weighting of burden (CDC PLACES), capacity (CMS NPPES + Census ACS), and vulnerability (CDC/ATSDR SVI).',
    source: 'Derived from PLACES, NPPES+ACS, SVI',
    sourceUrl: 'https://www.cdc.gov/places/index.html',
    decision: 'D-016: equal-thirds weighting (County Health Rankings precedent).',
    formula: '⅓ × burden + ⅓ × capacity + ⅓ × vulnerability',
    sqlSnippet:
      'SELECT egi_score FROM v_equity_gap_index WHERE fips = ?\n-- View body: sql/q05_equity_gap_index.sql',
  },
  egi_rank: {
    metricId: 'egi_rank',
    label: 'EGI Rank',
    description:
      'Position among the 82 MS counties from most underserved (#1) to least (#82). Uses DENSE_RANK so ties share a rank.',
    source: 'Computed across all 82 MS counties',
    decision: 'D-019: no population floor — Issaquena (pop 1,206) remains in the ranking.',
    sqlSnippet:
      'DENSE_RANK() OVER (ORDER BY egi_score DESC)',
  },
  egi_quintile: {
    metricId: 'egi_quintile',
    label: 'EGI Quintile',
    description:
      'NTILE(5) bucket: Q1 = most underserved 20%, Q5 = least. Color-coded green→red on the map.',
    source: 'Computed across all 82 MS counties',
    sqlSnippet: 'NTILE(5) OVER (ORDER BY egi_score DESC)',
  },
  burden_component: {
    metricId: 'burden_component',
    label: 'Burden Component',
    description:
      'Average of 10 PLACES burden measures, each per-measure min-max normalized to 0–100. Polarity-aware: CHECKUP and CHOLSCREEN are sign-flipped so higher = more burdened.',
    source: 'CDC PLACES (BRFSS 2022/2023)',
    sourceUrl: 'https://www.cdc.gov/places/index.html',
    decision: 'D-011: 10-measure composite chosen across 4 domains.',
    formula: 'AVG(normalized score) across 10 burden measures',
  },
  capacity_component: {
    metricId: 'capacity_component',
    label: 'Capacity Component',
    description:
      'State-wide min-max of primary-care providers per 10k residents, then inverted (100 = worst capacity). Six HRSA primary-care taxonomies.',
    source: 'CMS NPPES May 2026 + Census ACS 2018-2022 5-year',
    sourceUrl: 'https://download.cms.gov/nppes/NPI_Files.html',
    decision: 'D-008: 6 HRSA-aligned primary-care taxonomies. D-010 amended: largest-AREALAND_PART ZIP→county assignment.',
    formula: '100 − normalized(providers per 10,000 residents)',
  },
  vulnerability_component: {
    metricId: 'vulnerability_component',
    label: 'Vulnerability Component',
    description:
      'State-wide min-max of SVI 2022 overall percentile (RPL_THEMES). Per-state SVI file: percentiles are intra-Mississippi.',
    source: 'CDC/ATSDR SVI 2022 (Mississippi state file)',
    sourceUrl: 'https://www.atsdr.cdc.gov/place-health/php/svi/index.html',
    decision: 'D-007: per-state SVI file; intra-MS percentiles.',
  },
  pcp_per_10k: {
    metricId: 'pcp_per_10k',
    label: 'PCP per 10,000',
    description:
      'Primary-care providers per 10,000 residents. Sum across 6 HRSA taxonomies divided by ACS 2018–2022 5-year population.',
    source: 'CMS NPPES May 2026 + Census ACS',
    formula: 'providers × 10,000 / population',
  },
  rpl_themes: {
    metricId: 'rpl_themes',
    label: 'SVI Overall (RPL_THEMES)',
    description:
      'Intra-Mississippi percentile rank across all 4 SVI themes. 0.0 = least vulnerable MS county, 1.0 = most.',
    source: 'CDC/ATSDR SVI 2022 — Mississippi state file',
    decision: 'D-014: -999 sentinel coerced to NULL at load.',
  },
  rpl_theme1_socioeconomic: {
    metricId: 'rpl_theme1_socioeconomic',
    label: 'SVI Theme 1 — Socioeconomic Status',
    description: 'Income, poverty, education, employment. Intra-MS percentile (0–1).',
    source: 'CDC/ATSDR SVI 2022',
  },
  rpl_theme2_household: {
    metricId: 'rpl_theme2_household',
    label: 'SVI Theme 2 — Household Characteristics',
    description: 'Age, disability, single-parent, English proficiency. Intra-MS percentile (0–1).',
    source: 'CDC/ATSDR SVI 2022',
  },
  rpl_theme3_minority: {
    metricId: 'rpl_theme3_minority',
    label: 'SVI Theme 3 — Racial & Ethnic Minority Status',
    description: 'Racial/ethnic minority population share. Intra-MS percentile (0–1).',
    source: 'CDC/ATSDR SVI 2022',
  },
  rpl_theme4_housing_transport: {
    metricId: 'rpl_theme4_housing_transport',
    label: 'SVI Theme 4 — Housing Type & Transportation',
    description:
      'Multi-unit/mobile-home housing, crowding, no vehicle, group quarters. Intra-MS percentile (0–1).',
    source: 'CDC/ATSDR SVI 2022',
  },
  population: {
    metricId: 'population',
    label: 'Population',
    description: 'Census ACS 5-year (2018–2022) total population estimate, B01003_001E.',
    source: 'US Census Bureau ACS',
    sourceUrl: 'https://api.census.gov/data/2022/acs/acs5',
  },
  region: {
    metricId: 'region',
    label: 'Region',
    description:
      'Curated 4-region partition: Delta (18 MDRA counties), Coastal (3), Pine Belt (8), Other (53).',
    source: 'Mississippi Delta Regional Authority + MS Department of Health',
    sourceUrl: 'https://msdelta.gov/',
    decision: 'D-013: 4-region partition with cited authorities.',
  },
  is_rural: {
    metricId: 'is_rural',
    label: 'Rural Flag',
    description:
      'is_rural = 1 if population < 50,000 (proxy for USDA RUCC 4–9 non-metro classification).',
    source: 'Derived from Census ACS population',
  },
};

export function getAuditEntry(metricId: string): AuditEntry | undefined {
  return ENTRIES[metricId];
}

export function listAuditEntries(): AuditEntry[] {
  return Object.values(ENTRIES);
}
