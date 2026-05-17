-- =============================================================================
-- q01_state_overview.sql — Mississippi-wide context for the EGI analysis
-- =============================================================================
-- PURPOSE:    Establish the state-level baseline the README opens on. Three
--             sections: (1) which 5 datasets feed the analysis,
--             (2) geographic + demographic + provider scope (one row),
--             (3) all 10 burden-composite measures, ranked by state-mean
--             age-adjusted prevalence.
-- TABLES:     data_sources, counties, provider_capacity, taxonomies,
--             health_indicators, measures
-- TECHNIQUES: CTEs, multi-CTE composition, multi-table JOINs, aggregate
--             functions (AVG/SUM/MIN/MAX/COUNT), ORDER BY, LIMIT
-- OUTPUT:     Three result sets. The CSV exporter saves the third (top
--             burden measures) as data/processed/q01_state_overview.csv
--             — that table is what the README opens with.
-- DESIGN:     The simplest query in the suite. Establishes the header
--             comment format, the year-mix CTE pattern (see Section 3
--             note), the age-adjusted filter convention, and the
--             multi-section "context" structure that none of the deeper
--             queries (q02-q08) use. Section 1's output (5 rows) is the
--             audit-trail proof: every fact reported in q02-q08 traces
--             to one of these 5 federal sources.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1 — Data provenance (5 rows; one per loaded dataset)
-- ----------------------------------------------------------------------------
SELECT
    source_id,
    publisher,
    vintage,
    retrieval_date,
    rows_loaded,
    notes
FROM data_sources
ORDER BY publisher, source_id;


-- ----------------------------------------------------------------------------
-- SECTION 2 — Geographic + demographic + provider scope (one row)
--
-- Note: total_primary_care_providers = 6,377 county-attributable providers.
-- 27 NPPES providers across 14 unmatched ZIPs (D-010 PO-box, 1 AL border,
-- 1 likely FL typo) are excluded; 27 are preserved in the providers
-- table with fips=NULL for audit.
-- ----------------------------------------------------------------------------
WITH
geo AS (
    SELECT COUNT(*) AS n_counties, SUM(population) AS total_population
    FROM counties
),
capacity AS (
    SELECT SUM(provider_count) AS total_primary_care_providers
    FROM provider_capacity
)
SELECT
    g.n_counties,
    g.total_population,
    c.total_primary_care_providers,
    ROUND(1.0 * c.total_primary_care_providers * 10000.0 / g.total_population, 2)
        AS state_pcp_per_10k
FROM geo g, capacity c;


-- ----------------------------------------------------------------------------
-- SECTION 3 — All 10 burden-composite measures, ranked by state-mean age-adjusted prevalence
-- ----------------------------------------------------------------------------
-- Year-mix handling note (recurs in q02, q05, q06, q08):
--   PLACES 2025 release contains both 2022 and 2023 BRFSS rows. 4 measures
--   (BPHIGH, BPMED, CHOLSCREEN, HIGHCHOL) still use 2022 BRFSS pending
--   updated estimates; the other 36 moved to 2023. To compare counties
--   fairly we always pick MAX(year) per measure_id via the `latest` CTE
--   below.
-- ----------------------------------------------------------------------------

WITH latest AS (
    SELECT measure_id, MAX(year) AS y
    FROM health_indicators
    GROUP BY measure_id
)
SELECT
    m.measure_id,
    m.measure_short,
    m.category,
    l.y AS year,
    ROUND(AVG(hi.data_value), 2) AS state_mean_age_adj_pct,
    ROUND(MIN(hi.data_value), 2) AS county_min_pct,
    ROUND(MAX(hi.data_value), 2) AS county_max_pct
FROM measures m
JOIN latest l            ON l.measure_id  = m.measure_id
JOIN health_indicators hi ON hi.measure_id = m.measure_id
                         AND hi.year       = l.y
                         AND hi.data_value_type = 'Age-adjusted prevalence'
WHERE m.is_in_burden_composite = 1
GROUP BY m.measure_id, m.measure_short, m.category, l.y
ORDER BY state_mean_age_adj_pct DESC;
