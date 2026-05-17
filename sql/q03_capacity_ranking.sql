-- =============================================================================
-- q03_capacity_ranking.sql — counties ranked by primary-care capacity scarcity
-- =============================================================================
-- PURPOSE:    Rank Mississippi's 82 counties by primary-care provider
--             SCARCITY. Higher capacity_gap_score = fewer providers per
--             capita = more underserved.
-- TABLES:     provider_capacity, counties
-- TECHNIQUES: 3 CTEs (per-county provider sum, density metric, min-max
--             scoring via window function), DENSE_RANK() OVER (ORDER BY ...),
--             NTILE(5) OVER (...) for quintiles, MIN/MAX OVER () for
--             state-wide normalization.
-- OUTPUT:     82 rows: fips, county_name, region, population,
--             total_providers, pcp_per_10k, capacity_gap_score [0-100],
--             capacity_rank [1-82, 1=worst], capacity_quintile [1-5, 1=worst].
-- DESIGN:     pcp_per_10k = primary-care providers per 10,000 residents
--             (D-008 taxonomies, county-attributed via D-010 crosswalk).
--             capacity_gap_score INVERTS the normalized density so that a
--             county with the lowest pcp_per_10k gets the highest gap
--             score (100 = worst capacity, 0 = best). Quintile=1 is the
--             most underserved quintile by capacity. DENSE_RANK (not RANK)
--             is used so "top 10 underserved" returns at most 10 distinct
--             gap-score levels.
-- =============================================================================

WITH
-- 1. Total active primary-care providers per county (sum across 6 taxonomies).
--    Includes zero-count rows for taxonomies that don't appear in a county
--    (loader seeded those for join safety).
pc_total AS (
    -- total_providers excludes the 27 NPPES providers across 14 unmatched
    -- ZIPs (D-010 PO-box + 1 AL border + 1 likely FL typo). Those providers
    -- are preserved in the providers table with fips IS NULL for audit.
    SELECT fips, SUM(provider_count) AS total_providers
    FROM provider_capacity
    GROUP BY fips
),

-- 2. Density metric: providers per 10,000 residents.
--    Cast to REAL via 1.0 * ... to avoid SQLite integer division.
capacity_raw AS (
    SELECT
        c.fips,
        pct.total_providers,
        1.0 * pct.total_providers * 10000.0 / c.population AS pcp_per_10k
    FROM counties c
    JOIN pc_total pct USING (fips)
),

-- 3. Min-max normalize pcp_per_10k to 0-100, then INVERT so that
--    capacity_gap_score is high when capacity is low.
--    gap = 100 - normalized(pcp_per_10k).
capacity_scored AS (
    SELECT
        fips,
        total_providers,
        pcp_per_10k,
        100.0 - 100.0 * (pcp_per_10k - MIN(pcp_per_10k) OVER ())
                      / NULLIF(  MAX(pcp_per_10k) OVER ()
                               - MIN(pcp_per_10k) OVER (),
                               0)
            AS capacity_gap_score
    FROM capacity_raw
)

-- 4. Join county metadata, rank (DENSE_RANK so "top 10 underserved" is at
--    most 10 distinct levels), quintile.
SELECT
    c.fips,
    c.county_name,
    c.region,
    c.population,
    cs.total_providers,
    ROUND(cs.pcp_per_10k,         2) AS pcp_per_10k,
    ROUND(cs.capacity_gap_score,  2) AS capacity_gap_score,
    DENSE_RANK() OVER (ORDER BY cs.capacity_gap_score DESC) AS capacity_rank,
    NTILE(5)     OVER (ORDER BY cs.capacity_gap_score DESC) AS capacity_quintile
FROM capacity_scored cs
JOIN counties c USING (fips)
ORDER BY capacity_rank;
