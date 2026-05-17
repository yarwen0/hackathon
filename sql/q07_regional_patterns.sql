-- =============================================================================
-- q07_regional_patterns.sql — Delta vs non-Delta + rural vs urban contrast
-- =============================================================================
-- PURPOSE:    Produce summary contrasts of the EGI and its three components
--             across two policy-salient county groupings: (A) Delta vs
--             non-Delta, and (B) rural (pop < 50,000) vs urban. Each
--             section reports county count, component means, EGI mean,
--             EGI max, and the name of the highest-EGI county in the group.
-- TABLES:     v_equity_gap_index, counties
-- TECHNIQUES: 2 result sets in one file; window function ROW_NUMBER() per
--             group to identify the top-EGI county; conditional MAX
--             aggregation to surface the top name; GROUP BY with derived
--             group-name column via CASE.
-- OUTPUT:     SECTION A — Delta vs non-Delta: 2 rows
--             SECTION B — Rural vs urban: 2 rows
--             Both sections share columns: group_name, county_count,
--             mean_burden, mean_capacity, mean_vulnerability, mean_egi,
--             max_egi, top_egi_county.
-- DESIGN:     The same query pattern is used for both sections — only the
--             grouping column changes (is_delta vs is_rural). is_delta and
--             is_rural live on the counties table (not on v_equity_gap_index),
--             so each section starts by joining counties. CSV exporter saves
--             both sections to separate files (q07a, q07b) since Phase 4
--             may want both at-a-glance contrasts.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A — Delta vs non-Delta
-- ----------------------------------------------------------------------------
WITH v_flagged_a AS (
    SELECT v.*, c.is_delta
    FROM v_equity_gap_index v
    JOIN counties c USING (fips)
),
ranked_a AS (
    SELECT
        v.*,
        ROW_NUMBER() OVER (PARTITION BY is_delta ORDER BY egi_score DESC) AS rn
    FROM v_flagged_a v
)
SELECT
    CASE WHEN is_delta = 1 THEN 'Delta' ELSE 'Non-Delta' END AS group_name,
    COUNT(*)                                        AS county_count,
    ROUND(AVG(burden_component),        2)          AS mean_burden,
    ROUND(AVG(capacity_component),      2)          AS mean_capacity,
    ROUND(AVG(vulnerability_component), 2)          AS mean_vulnerability,
    ROUND(AVG(egi_score),               2)          AS mean_egi,
    ROUND(MAX(egi_score),               2)          AS max_egi,
    MAX(CASE WHEN rn = 1 THEN county_name END)      AS top_egi_county
FROM ranked_a
GROUP BY is_delta
ORDER BY mean_egi DESC;


-- ----------------------------------------------------------------------------
-- SECTION B — Rural vs urban (is_rural derived from population < 50,000)
-- ----------------------------------------------------------------------------
WITH v_flagged_b AS (
    SELECT v.*, c.is_rural
    FROM v_equity_gap_index v
    JOIN counties c USING (fips)
),
ranked_b AS (
    SELECT
        v.*,
        ROW_NUMBER() OVER (PARTITION BY is_rural ORDER BY egi_score DESC) AS rn
    FROM v_flagged_b v
)
SELECT
    CASE WHEN is_rural = 1 THEN 'Rural (pop < 50k)' ELSE 'Urban (pop >= 50k)' END AS group_name,
    COUNT(*)                                        AS county_count,
    ROUND(AVG(burden_component),        2)          AS mean_burden,
    ROUND(AVG(capacity_component),      2)          AS mean_capacity,
    ROUND(AVG(vulnerability_component), 2)          AS mean_vulnerability,
    ROUND(AVG(egi_score),               2)          AS mean_egi,
    ROUND(MAX(egi_score),               2)          AS max_egi,
    MAX(CASE WHEN rn = 1 THEN county_name END)      AS top_egi_county
FROM ranked_b
GROUP BY is_rural
ORDER BY mean_egi DESC;
