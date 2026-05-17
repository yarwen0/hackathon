-- =============================================================================
-- q08_drivers_analysis.sql — per-county drivers for the top-10 EGI counties
-- =============================================================================
-- PURPOSE:    For each of the 10 most-underserved counties, identify the
--             specific drivers behind its underservedness: which 2 PLACES
--             burden measures most exceed state mean (polarity-aware),
--             whether the county has zero attributed primary-care providers,
--             and which SVI theme is dominant. One row per top-10 county.
-- TABLES:     v_equity_gap_index, health_indicators, measures,
--             social_vulnerability
-- TECHNIQUES: 6 chained CTEs (top10 filter, latest year, state means,
--             polarity-aware deviation per county-measure, ROW_NUMBER
--             ranking, dominant_svi via CASE reused from q04),
--             conditional MAX aggregation to pivot dev_rank=1 / dev_rank=2
--             into named columns.
-- OUTPUT:     10 rows: fips, county_name, egi_rank,
--             top_burden_measure_1 (most extreme deviation from state mean),
--             top_burden_measure_2 (second-most extreme),
--             has_zero_providers (0/1), dominant_svi_theme (TEXT).
-- DESIGN:     "burden deviation" is computed as polarity * (county_value -
--             state_mean) so that both polarity=+1 measures (where higher =
--             worse) and polarity=-1 measures (where lower = worse) point
--             in the same direction: positive deviation = county is more
--             burdened than state average on that measure. The top-2 by
--             deviation are then the most extreme negative drivers for
--             that county. has_zero_providers uses
--             capacity_component = 100 (the only way to get exactly 100
--             under the min-max scoring is to have the minimum pcp_per_10k,
--             which in MS is 0 — verified post D-010 amendment).
-- =============================================================================

WITH
-- 1. The 10 top-EGI counties.
top10 AS (
    SELECT * FROM v_equity_gap_index WHERE egi_rank <= 10
),

-- 2. Latest BRFSS year per PLACES measure (year-mix per Convention C3).
latest AS (
    SELECT measure_id, MAX(year) AS y
    FROM health_indicators
    GROUP BY measure_id
),

-- 3. State means for the 10 burden composite measures, age-adjusted.
state_means AS (
    SELECT m.measure_id, AVG(hi.data_value) AS state_mean
    FROM health_indicators hi
    JOIN measures m USING (measure_id)
    JOIN latest l  ON l.measure_id = hi.measure_id AND l.y = hi.year
    WHERE hi.data_value_type      = 'Age-adjusted prevalence'
      AND m.is_in_burden_composite = 1
    GROUP BY m.measure_id
),

-- 4. For each top-10 county x burden measure: deviation from state mean,
--    polarity-applied so positive deviation = more burdened than state avg.
--    ROW_NUMBER ranks deviations within each county; dev_rank=1 is the
--    biggest "above state mean" driver.
county_burden_dev AS (
    SELECT
        hi.fips,
        m.measure_short,
        m.polarity * (hi.data_value - sm.state_mean) AS burden_deviation,
        ROW_NUMBER() OVER (
            PARTITION BY hi.fips
            ORDER BY m.polarity * (hi.data_value - sm.state_mean) DESC
        ) AS dev_rank
    FROM health_indicators hi
    JOIN measures m USING (measure_id)
    JOIN latest l     ON l.measure_id = hi.measure_id AND l.y = hi.year
    JOIN state_means sm USING (measure_id)
    JOIN top10 t      ON t.fips = hi.fips
    WHERE hi.data_value_type      = 'Age-adjusted prevalence'
      AND m.is_in_burden_composite = 1
),

-- 5. Pivot dev_rank=1 / dev_rank=2 into named columns per county.
top_burdens AS (
    SELECT
        fips,
        MAX(CASE WHEN dev_rank = 1 THEN measure_short END) AS top_burden_measure_1,
        MAX(CASE WHEN dev_rank = 2 THEN measure_short END) AS top_burden_measure_2
    FROM county_burden_dev
    GROUP BY fips
),

-- 6. Dominant SVI theme per county (CASE chain reused from q04;
--    declared order resolves ties theme1 > theme2 > theme3 > theme4).
dominant_svi AS (
    SELECT
        fips,
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
        END AS dominant_svi_theme
    FROM social_vulnerability
)

-- 7. One row per top-10 county with all 3 driver signals.
SELECT
    t.fips,
    t.county_name,
    t.egi_rank,
    tb.top_burden_measure_1,
    tb.top_burden_measure_2,
    CASE WHEN t.capacity_component = 100.0 THEN 1 ELSE 0 END AS has_zero_providers,
    ds.dominant_svi_theme
FROM top10 t
JOIN top_burdens  tb USING (fips)
JOIN dominant_svi ds USING (fips)
ORDER BY t.egi_rank;
