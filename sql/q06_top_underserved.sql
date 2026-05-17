-- =============================================================================
-- q06_top_underserved.sql — top 10 EGI counties with driver profile
-- =============================================================================
-- PURPOSE:    Surface the 10 most-underserved Mississippi counties from
--             v_equity_gap_index along with a derived driver_profile that
--             tells the reader at a glance whether each county's high EGI
--             comes from a single extreme pillar or all three pillars
--             together. Makes D-019's promise of transparency visible
--             (per QUESTIONS.md note).
-- TABLES:     v_equity_gap_index
-- TECHNIQUES: UNPIVOT via UNION ALL (3 components -> long form),
--             ROW_NUMBER() OVER (PARTITION BY fips ORDER BY val DESC),
--             conditional MAX aggregation, CASE for driver_profile bins,
--             multi-CTE composition.
-- OUTPUT:     10 rows: fips, county_name, region, population,
--             burden_component, capacity_component, vulnerability_component,
--             egi_score, egi_rank, dominant_component (TEXT),
--             driver_profile (TEXT — one of "single-component dominant",
--             "one component leading", "multi-component").
-- DESIGN:     driver_profile thresholds (30 pp / 15 pp) come from QUESTIONS.md;
--             chosen to make the Issaquena case ("multi-component", top vs
--             second gap = 9.88) visibly different from any single-component
--             counter-example. UNPIVOT was chosen over nested CASE because
--             extracting both max and second_max via CASE in SQL requires
--             ~12 nested WHEN clauses and is fragile. The UNPIVOT pattern
--             scales cleanly if components are ever added/removed.
-- =============================================================================

WITH
-- 1. The top 10 EGI counties (rank <= 10).
top10 AS (
    SELECT *
    FROM v_equity_gap_index
    WHERE egi_rank <= 10
),

-- 2. UNPIVOT: turn the 3 component columns into 3 rows per county.
--    Gives us a long-form table we can window over.
components_long AS (
    SELECT fips, 'Burden'        AS component, burden_component        AS val FROM top10
    UNION ALL
    SELECT fips, 'Capacity',           capacity_component                   FROM top10
    UNION ALL
    SELECT fips, 'Vulnerability',      vulnerability_component              FROM top10
),

-- 3. Rank the 3 components within each county; component_rank=1 is the
--    dominant component, component_rank=2 is the runner-up.
ranked AS (
    SELECT
        fips,
        component,
        val,
        ROW_NUMBER() OVER (PARTITION BY fips ORDER BY val DESC) AS component_rank
    FROM components_long
),

-- 4. Collapse back to one row per county with the top + second-top extracted
--    via conditional MAX. dominant_component is the label of the top one;
--    max/second_max are the numeric values used for the driver_profile bin.
extremes AS (
    SELECT
        fips,
        MAX(CASE WHEN component_rank = 1 THEN component END) AS dominant_component,
        MAX(CASE WHEN component_rank = 1 THEN val       END) AS max_component,
        MAX(CASE WHEN component_rank = 2 THEN val       END) AS second_max_component
    FROM ranked
    GROUP BY fips
)

-- 5. Join top10 + extremes; derive driver_profile via the 30/15 pp bins
--    from the QUESTIONS.md spec.
SELECT
    t.fips,
    t.county_name,
    t.region,
    t.population,
    t.burden_component,
    t.capacity_component,
    t.vulnerability_component,
    t.egi_score,
    t.egi_rank,
    e.dominant_component,
    CASE
        WHEN (e.max_component - e.second_max_component) > 30 THEN 'single-component dominant'
        WHEN (e.max_component - e.second_max_component) > 15 THEN 'one component leading'
        ELSE 'multi-component'
    END AS driver_profile
FROM top10 t
JOIN extremes e USING (fips)
ORDER BY t.egi_rank;
