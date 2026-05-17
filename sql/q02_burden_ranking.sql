-- =============================================================================
-- q02_burden_ranking.sql — counties ranked by composite health burden
-- =============================================================================
-- PURPOSE:    Rank Mississippi's 82 counties by a composite burden score
--             that combines the 10 PLACES burden-composite measures (D-011).
--             Higher burden_score = more disease + worse healthcare access.
-- TABLES:     health_indicators, measures, counties
-- TECHNIQUES: 4 CTEs (latest year, polarity-flipped raw, per-measure min-max
--             normalization via window, per-county aggregation),
--             DENSE_RANK() OVER (ORDER BY ...), NTILE(5) OVER (...) for
--             quintiles, window function MIN/MAX with PARTITION BY,
--             multi-table JOINs.
-- OUTPUT:     82 rows: fips, county_name, region, population, burden_score
--             [0-100], measures_included [should be 10 for every row],
--             burden_rank [1-82, 1=worst], burden_quintile [1-5, 1=worst].
-- DESIGN:     Polarity (D-011) is multiplied BEFORE per-measure normalization
--             so that the 2 inverted burden measures (CHECKUP, CHOLSCREEN)
--             contribute to burden in the SAME direction as the other 8
--             after normalization. Per-measure normalization (vs pooled)
--             equalizes the influence of measures with very different scales
--             (OBESITY 36-53% vs CHD 5-8%). Year-mix handled via the latest
--             CTE pattern established in q01 (see q01 header for the note).
--             DENSE_RANK is used (not RANK) so that "burden_rank <= 10"
--             yields at most 10 distinct score levels — cleaner "top 10"
--             framing in the README and presentation.
-- =============================================================================

WITH
-- 1. Latest PLACES year per measure (4 measures still on 2022 BRFSS,
--    the other 6 of the burden composite use 2023 — pick latest per measure).
latest AS (
    SELECT measure_id, MAX(year) AS y
    FROM health_indicators
    GROUP BY measure_id
),

-- 2. Burden composite rows only, age-adjusted, polarity applied.
--    polarized_value: same magnitude as the raw % but sign-flipped for the
--    2 measures whose polarity = -1 (CHECKUP, CHOLSCREEN). After flipping,
--    "higher value = more burdened" for every measure.
burden_raw AS (
    SELECT
        hi.fips,
        hi.measure_id,
        m.polarity * hi.data_value AS polarized_value
    FROM health_indicators hi
    JOIN measures m USING (measure_id)
    JOIN latest l   ON l.measure_id = hi.measure_id AND l.y = hi.year
    WHERE m.is_in_burden_composite = 1
      AND hi.data_value_type       = 'Age-adjusted prevalence'
      AND hi.data_value IS NOT NULL
),

-- 3. Min-max normalize each measure across the 82 counties to a 0-100
--    "burden contribution" scale (PARTITION BY measure_id so each measure
--    is normalized against its own range). NULLIF guards against a
--    zero-range measure (which shouldn't happen in practice).
burden_normalized AS (
    SELECT
        fips,
        measure_id,
        100.0 * (polarized_value - MIN(polarized_value) OVER (PARTITION BY measure_id))
              / NULLIF(  MAX(polarized_value) OVER (PARTITION BY measure_id)
                       - MIN(polarized_value) OVER (PARTITION BY measure_id),
                       0)
            AS normalized_score
    FROM burden_raw
),

-- 4. Mean of the 10 normalized scores per county = composite burden score.
--    measures_included is surfaced for defensibility: any county with
--    fewer than 10 contributing measures (e.g., if PLACES suppressed a
--    value) becomes visible in the output rather than silently averaged
--    over a smaller set.
burden_composite AS (
    SELECT
        fips,
        ROUND(AVG(normalized_score), 2) AS burden_score,
        COUNT(*) AS measures_included     -- always 10 in current data; surface for defensibility
    FROM burden_normalized
    WHERE normalized_score IS NOT NULL    -- exclude any NULL normalized scores from the count too
    GROUP BY fips
)

-- 5. Join county metadata, rank (DENSE_RANK so "top 10" is at most 10
--    distinct levels), quintile (1 = most burdened).
SELECT
    c.fips,
    c.county_name,
    c.region,
    c.population,
    bc.burden_score,
    bc.measures_included,
    DENSE_RANK() OVER (ORDER BY bc.burden_score DESC) AS burden_rank,
    NTILE(5)     OVER (ORDER BY bc.burden_score DESC) AS burden_quintile
FROM burden_composite bc
JOIN counties c USING (fips)
ORDER BY burden_rank;
