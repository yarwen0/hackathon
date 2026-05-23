// Centralized SQL templates. Every read query lives here so the data layer
// has a single audit surface and so the methodology page can show users the
// exact SQL behind any number on the screen.

// ---------- Static SELECTs ----------

export const SQL_RANKING_BASE = /* sql */ `
  SELECT
    v.fips,
    v.county_name,
    v.region,
    v.population,
    v.burden_component,
    v.capacity_component,
    v.vulnerability_component,
    v.egi_score,
    v.egi_rank,
    v.egi_quintile,
    c.is_delta,
    c.is_rural,
    c.latitude,
    c.longitude
  FROM v_equity_gap_index v
  JOIN counties c USING (fips)
`;

export const SQL_STATE_MEANS = /* sql */ `
  SELECT
    AVG(egi_score)                  AS meanEgi,
    AVG(burden_component)           AS meanBurden,
    AVG(capacity_component)         AS meanCapacity,
    AVG(vulnerability_component)    AS meanVulnerability,
    SUM(population)                 AS totalPopulation,
    COUNT(*)                        AS counties
  FROM v_equity_gap_index
`;

export const SQL_COUNTY_BY_FIPS = SQL_RANKING_BASE + ' WHERE v.fips = ?';

export const SQL_BURDEN_DRIVERS = /* sql */ `
  WITH latest AS (
    SELECT measure_id, MAX(year) AS y
    FROM health_indicators
    GROUP BY measure_id
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
    hi.measure_id,
    m.measure_short,
    m.measure_full,
    m.category,
    hi.data_value AS value,
    sm.state_mean,
    m.polarity * (hi.data_value - sm.state_mean) AS deviation,
    hi.year,
    m.notes,
    m.polarity
  FROM health_indicators hi
  JOIN measures m USING (measure_id)
  JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
  JOIN state_means sm USING (measure_id)
  WHERE hi.fips = ?
    AND hi.data_value_type = 'Age-adjusted prevalence'
    AND m.is_in_burden_composite = 1
  ORDER BY deviation DESC
`;

export const SQL_PROVIDERS_BY_COUNTY = /* sql */ `
  SELECT
    pc.taxonomy_code,
    t.taxonomy_label,
    pc.provider_count,
    CASE
      WHEN c.population > 0
        THEN 1.0 * pc.provider_count * 10000.0 / c.population
      ELSE 0
    END AS per_10k
  FROM provider_capacity pc
  JOIN taxonomies t USING (taxonomy_code)
  JOIN counties c USING (fips)
  WHERE pc.fips = ?
  ORDER BY pc.provider_count DESC, t.taxonomy_label
`;

export const SQL_SVI_BY_COUNTY = /* sql */ `
  SELECT
    rpl_themes,
    rpl_theme1_socioeconomic,
    rpl_theme2_household,
    rpl_theme3_minority,
    rpl_theme4_housing_transport,
    ep_pov150,
    ep_uninsur,
    ep_disabl,
    ep_minrty,
    ep_noveh,
    CASE
      WHEN rpl_theme1_socioeconomic >= rpl_theme2_household
       AND rpl_theme1_socioeconomic >= rpl_theme3_minority
       AND rpl_theme1_socioeconomic >= rpl_theme4_housing_transport
          THEN 'Socioeconomic Status'
      WHEN rpl_theme2_household >= rpl_theme3_minority
       AND rpl_theme2_household >= rpl_theme4_housing_transport
          THEN 'Household Characteristics'
      WHEN rpl_theme3_minority >= rpl_theme4_housing_transport
          THEN 'Racial & Ethnic Minority Status'
      ELSE 'Housing Type & Transportation'
    END AS dominant_theme,
    max(
      COALESCE(rpl_theme1_socioeconomic, 0),
      COALESCE(rpl_theme2_household, 0),
      COALESCE(rpl_theme3_minority, 0),
      COALESCE(rpl_theme4_housing_transport, 0)
    ) AS dominant_theme_value
  FROM social_vulnerability
  WHERE fips = ?
`;

export const SQL_DATA_SOURCES = /* sql */ `
  SELECT
    source_id,
    dataset_name,
    publisher,
    vintage,
    release_date,
    retrieval_date,
    source_url,
    rows_loaded,
    notes
  FROM data_sources
  ORDER BY publisher, source_id
`;

export const SQL_COUNTY_NAMES = /* sql */ `
  SELECT fips, county_name FROM counties ORDER BY county_name
`;

// ---------- Reweight: inline the v_equity_gap_index CTE chain with
// parameterized weights via ? placeholders. NEVER string-concat weights.
// Order of ? placeholders: w_burden, w_capacity, w_vulnerability.

export const SQL_REWEIGHT = /* sql */ `
  WITH
  weights AS (
    SELECT
      CAST(? AS REAL) AS w_burden,
      CAST(? AS REAL) AS w_capacity,
      CAST(? AS REAL) AS w_vulnerability
  ),
  latest AS (
    SELECT measure_id, MAX(year) AS y
    FROM health_indicators
    GROUP BY measure_id
  ),
  burden_raw AS (
    SELECT
      hi.fips,
      hi.measure_id,
      m.polarity * hi.data_value AS polarized_value
    FROM health_indicators hi
    JOIN measures m USING (measure_id)
    JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
    WHERE m.is_in_burden_composite = 1
      AND hi.data_value_type = 'Age-adjusted prevalence'
      AND hi.data_value IS NOT NULL
  ),
  burden_normalized AS (
    SELECT
      fips,
      measure_id,
      100.0 * (polarized_value - MIN(polarized_value) OVER (PARTITION BY measure_id))
            / NULLIF(MAX(polarized_value) OVER (PARTITION BY measure_id)
                   - MIN(polarized_value) OVER (PARTITION BY measure_id), 0)
        AS normalized_score
    FROM burden_raw
  ),
  burden_per_county AS (
    SELECT fips, AVG(normalized_score) AS burden_component
    FROM burden_normalized
    WHERE normalized_score IS NOT NULL
    GROUP BY fips
  ),
  capacity_total AS (
    SELECT fips, SUM(provider_count) AS total_providers
    FROM provider_capacity
    GROUP BY fips
  ),
  capacity_raw AS (
    SELECT c.fips, 1.0 * ct.total_providers * 10000.0 / c.population AS pcp_per_10k
    FROM counties c
    JOIN capacity_total ct USING (fips)
  ),
  capacity_scored AS (
    SELECT
      fips,
      100.0 - 100.0 * (pcp_per_10k - MIN(pcp_per_10k) OVER ())
                    / NULLIF(MAX(pcp_per_10k) OVER () - MIN(pcp_per_10k) OVER (), 0)
        AS capacity_component
    FROM capacity_raw
  ),
  vulnerability_scored AS (
    SELECT
      fips,
      100.0 * (rpl_themes - MIN(rpl_themes) OVER ())
            / NULLIF(MAX(rpl_themes) OVER () - MIN(rpl_themes) OVER (), 0)
        AS vulnerability_component
    FROM social_vulnerability
  ),
  combined AS (
    SELECT
      b.fips,
      b.burden_component,
      cs.capacity_component,
      vs.vulnerability_component,
        w.w_burden        * b.burden_component
      + w.w_capacity      * cs.capacity_component
      + w.w_vulnerability * vs.vulnerability_component AS reweighted_score
    FROM burden_per_county    b
    JOIN capacity_scored      cs USING (fips)
    JOIN vulnerability_scored vs USING (fips)
    CROSS JOIN weights        w
  )
  SELECT
    c.fips,
    c.county_name,
    c.region,
    c.population,
    ROUND(co.burden_component, 2)        AS burden_component,
    ROUND(co.capacity_component, 2)      AS capacity_component,
    ROUND(co.vulnerability_component, 2) AS vulnerability_component,
    ROUND(co.reweighted_score, 2)        AS reweighted_score,
    DENSE_RANK() OVER (ORDER BY co.reweighted_score DESC) AS reweighted_rank
  FROM combined co
  JOIN counties c USING (fips)
  ORDER BY co.reweighted_score DESC,
           co.vulnerability_component DESC,
           c.population DESC,
           c.fips ASC
`;

// ---------- Cohort-builder filters apply WHERE clauses against base ranking,
// joined with PLACES burden measures for advanced thresholds.

export interface PlacesMeasureRow {
  fips: string;
  measure_id: string;
  value: number;
}

export const SQL_PLACES_LATEST = /* sql */ `
  WITH latest AS (
    SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id
  )
  SELECT hi.fips, hi.measure_id, hi.data_value AS value
  FROM health_indicators hi
  JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
  WHERE hi.data_value_type = 'Age-adjusted prevalence'
    AND hi.data_value IS NOT NULL
    AND hi.measure_id IN ('DIABETES','OBESITY','ACCESS2','BPHIGH','MHLTH','CHD','COPD','DEPRESSION','CHECKUP','CHOLSCREEN')
`;

export const SQL_PCP_PER_10K = /* sql */ `
  SELECT
    c.fips,
    1.0 * COALESCE(SUM(pc.provider_count), 0) * 10000.0 / c.population AS pcp_per_10k,
    1.0 * COALESCE(SUM(CASE WHEN pc.taxonomy_code = '207Q00000X' THEN pc.provider_count ELSE 0 END), 0)
        * 10000.0 / c.population AS fm_per_10k
  FROM counties c
  LEFT JOIN provider_capacity pc ON pc.fips = c.fips
  GROUP BY c.fips, c.population
`;

export const SQL_SVI_UNINSURED = /* sql */ `
  SELECT fips, ep_uninsur FROM social_vulnerability
`;

// All 82 counties + components for quadrant scatter.

export const SQL_QUADRANT = SQL_RANKING_BASE + ' ORDER BY v.egi_score DESC';

// Methodology page: data sources for cards.

export const SQL_DATA_SOURCES_FULL = SQL_DATA_SOURCES;
