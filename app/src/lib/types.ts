// EGI Workbench — end-to-end typed contracts between API routes and components.
// Every API route imports its request/response types from this file; every UI
// component reads from the same types so the boundary is enforced by tsc.

// ---------- Domain primitives ----------

export type FIPS = string;
export type Region = 'Delta' | 'Coastal' | 'Pine Belt' | 'Other';
export type Role = 'program_officer' | 'methodology_steward' | 'external_collaborator';

// ---------- County / ranking shapes ----------

export interface CountyRow {
  fips: FIPS;
  county_name: string;
  region: Region;
  population: number;
  burden_component: number;
  capacity_component: number;
  vulnerability_component: number;
  egi_score: number;
  egi_rank: number;
  egi_quintile: number;
  is_delta: 0 | 1;
  is_rural: 0 | 1;
  latitude: number | null;
  longitude: number | null;
}

export interface RankingFilters {
  region?: Region[];
  rural?: boolean;
  quintile?: number[];
  populationMin?: number;
  populationMax?: number;
  egiMin?: number;
  egiMax?: number;
  search?: string;
  sort?: keyof CountyRow;
  dir?: 'asc' | 'desc';
}

export interface RankingResponse {
  rows: CountyRow[];
  total: number;
  appliedFilters: RankingFilters;
  stateStats: {
    meanEgi: number;
    meanBurden: number;
    meanCapacity: number;
    meanVulnerability: number;
    totalPopulation: number;
    counties: number;
  };
}

// ---------- County drilldown ----------

export interface CountyBurdenDriver {
  measure_id: string;
  measure_short: string;
  measure_full: string;
  category: string;
  value: number;
  state_mean: number;
  deviation: number; // polarity-adjusted; positive = worse than state
  year: number;
  notes: string | null;
  polarity: -1 | 1;
}

export interface CountyProviderRow {
  taxonomy_code: string;
  taxonomy_label: string;
  provider_count: number;
  per_10k: number;
}

export interface CountySVI {
  rpl_themes: number | null;
  rpl_theme1_socioeconomic: number | null;
  rpl_theme2_household: number | null;
  rpl_theme3_minority: number | null;
  rpl_theme4_housing_transport: number | null;
  ep_pov150: number | null;
  ep_uninsur: number | null;
  ep_disabl: number | null;
  ep_minrty: number | null;
  ep_noveh: number | null;
  dominant_theme: string;
  dominant_theme_value: number;
}

export interface CountyResponse {
  county: CountyRow;
  drivers: CountyBurdenDriver[];
  providers: CountyProviderRow[];
  totalProviders: number;
  providersPer10k: number;
  svi: CountySVI;
  interpretation: string; // generated plain-English summary
  stateMeans: {
    egi: number;
    burden: number;
    capacity: number;
    vulnerability: number;
  };
}

// ---------- Compare ----------

export interface CompareRow {
  id: string;
  label: string;
  group: 'Summary' | 'Components' | 'SVI Themes' | 'Providers' | 'Burden Drivers';
  a: number | null;
  b: number | null;
  unit: '' | '%' | 'per 10k' | 'people' | 'score';
  format: 'integer' | 'decimal' | 'percent' | 'score';
  higherIsWorse: boolean;
}

export interface CompareResponse {
  a: CountyRow;
  b: CountyRow;
  rows: CompareRow[];
}

// ---------- Cohort builder ----------

export interface CohortCriteria {
  egiMin?: number;
  egiMax?: number;
  burdenMin?: number;
  burdenMax?: number;
  capacityMin?: number;
  capacityMax?: number;
  vulnerabilityMin?: number;
  vulnerabilityMax?: number;
  populationMin?: number;
  populationMax?: number;
  region?: Region[];
  rural?: boolean | null;
  quintile?: number[];
  diabetesMin?: number;
  obesityMin?: number;
  uninsuredMin?: number;
  fmPer10kMax?: number;
}

export interface CohortStats {
  countyCount: number;
  totalPopulation: number;
  meanEgi: number;
  medianEgi: number;
  meanBurden: number;
  meanCapacity: number;
  meanVulnerability: number;
  pcpPer10kMedian: number;
  uninsuredMedian: number;
  topDrivers: Array<{ measure_short: string; mean_value: number; state_mean: number }>;
  regionBreakdown: Array<{ region: Region; count: number }>;
}

export interface CohortResponse {
  rows: CountyRow[];
  stats: CohortStats;
  criteria: CohortCriteria;
}

export interface SavedCohort {
  token: string;
  name: string | null;
  criteria: CohortCriteria;
  ownerId: string;
  ownerEmail: string;
  createdAt: number;
  countySnapshot: FIPS[];
}

// ---------- Quadrant ----------

export interface QuadrantPoint {
  fips: FIPS;
  county_name: string;
  region: Region;
  burden: number;
  vulnerability: number;
  capacity: number;
  population: number;
  egi: number;
  isOffDiagonal: boolean;
}

export interface QuadrantResponse {
  points: QuadrantPoint[];
  stateMeans: { burden: number; vulnerability: number; capacity: number };
}

// ---------- Reweight ----------

export interface ReweightWeights {
  burden: number; // 0–1
  capacity: number;
  vulnerability: number;
}

export interface ReweightRow {
  fips: FIPS;
  county_name: string;
  region: Region;
  population: number;
  burden_component: number;
  capacity_component: number;
  vulnerability_component: number;
  reweighted_score: number;
  reweighted_rank: number;
  baseline_rank: number;
  rank_change: number; // positive = improved (smaller rank), negative = worsened
}

export interface ReweightResponse {
  rows: ReweightRow[];
  weights: ReweightWeights;
  topCountyName: string;
  issaquenaStillNumber1: boolean;
  largestImprovement: { fips: FIPS; county_name: string; rank_change: number } | null;
  largestRegression: { fips: FIPS; county_name: string; rank_change: number } | null;
}

// ---------- Methodologies ----------

export type MethodologyId = 'equal_thirds' | 'pca' | 'burden_weighted';

export interface MethodologyRanking {
  id: MethodologyId;
  label: string;
  description: string;
  weights: ReweightWeights;
  top10: Array<{ fips: FIPS; county_name: string; score: number; rank: number }>;
}

export interface MethodologiesResponse {
  rankings: MethodologyRanking[];
  topCounty: {
    overlap: number;
    inAll: string[];
    onlyEqualThirds: string[];
    summary: string;
  };
  dataSources: DataSource[];
  pcaExplainedVarianceRatio: number;
}

export interface DataSource {
  source_id: string;
  dataset_name: string;
  publisher: string;
  vintage: string;
  release_date: string | null;
  retrieval_date: string;
  source_url: string;
  rows_loaded: number | null;
  notes: string | null;
}

// ---------- Ask the EGI ----------

export interface AskRequest {
  question: string;
}

export interface AskColumn {
  name: string;
}

export type AskCellValue = string | number | null;

export interface AskResponse {
  question: string;
  sql: string;
  explanation: string;
  summary: string;
  columns: AskColumn[];
  rows: AskCellValue[][];
  rowCount: number;
  truncated: boolean;
  source: 'chip' | 'llm';
  error?: string;
}

export interface StarterChip {
  id: string;
  label: string;
  question: string;
  sql: string;
}

// ---------- Auth ----------

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

export interface SessionPayload {
  userId: string;
  expiresAt: number;
}

// ---------- Audit map ----------

export interface AuditEntry {
  metricId: string;
  label: string;
  description: string;
  source: string;
  sourceUrl?: string;
  decision?: string;
  sqlSnippet?: string;
  formula?: string;
}
