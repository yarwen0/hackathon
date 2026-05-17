-- =============================================================================
-- Mississippi Health Equity Gap Index — Database Schema
-- =============================================================================
-- File:     schema/create_tables.sql
-- Purpose:  Create the full database schema in one idempotent pass. Drops any
--           existing tables in reverse-dependency order, then recreates all 9
--           tables and supporting indexes. Safe to run repeatedly on the same
--           database.db.
--
-- Engine:   SQLite 3.25+ (uses CHECK constraints and composite PRIMARY KEYs;
--           Phase 3 will additionally rely on window functions and CTEs).
--
-- Tables:
--   1. counties                — 82 MS counties; reference hub all facts join to.
--   2. data_sources            — provenance metadata for each of the 5 inputs.
--   3. measures                — 40 PLACES MeasureId catalog + burden flag + polarity.
--   4. taxonomies              — 6 HRSA-aligned primary-care taxonomies (D-008).
--   5. zcta_county_crosswalk   — 771 ZCTA-county rows with is_assigned flag (D-010).
--   6. health_indicators       — long-form PLACES facts (~6,560 rows).
--   7. social_vulnerability    — wide SVI 2022 facts, one row per county.
--   8. providers               — one row per NPI for traceability (~6,404 rows).
--   9. provider_capacity       — pre-aggregated counts per (county, taxonomy).
--
-- IMPORTANT: SQLite does NOT enforce FOREIGN KEYs by default. Callers must
-- execute `PRAGMA foreign_keys = ON;` on every new connection. The load
-- script (`python/01_load_data.py`) does this; running this file directly
-- via `sqlite3 database.db < schema/create_tables.sql` also enables it
-- because the PRAGMA below is included.
-- =============================================================================

PRAGMA foreign_keys = OFF;  -- disabled during DROPs to avoid order-of-drop issues

DROP TABLE IF EXISTS provider_capacity;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS zcta_county_crosswalk;
DROP TABLE IF EXISTS health_indicators;
DROP TABLE IF EXISTS social_vulnerability;
DROP TABLE IF EXISTS measures;
DROP TABLE IF EXISTS taxonomies;
DROP TABLE IF EXISTS counties;
DROP TABLE IF EXISTS data_sources;

PRAGMA foreign_keys = ON;   -- re-enable BEFORE creating tables, and required for inserts

-- -----------------------------------------------------------------------------
-- 1. counties — the reference hub. One row per MS county. Every fact table's
--    fips column points here. CHECK constraints scope to MS (state FIPS '28').
-- -----------------------------------------------------------------------------
CREATE TABLE counties (
    fips            TEXT NOT NULL PRIMARY KEY
                        CHECK (length(fips) = 5 AND substr(fips, 1, 2) = '28'),
    county_name     TEXT NOT NULL,
    state_fips      TEXT NOT NULL DEFAULT '28',
    state_abbr      TEXT NOT NULL DEFAULT 'MS',
    population      INTEGER NOT NULL CHECK (population > 0),
    region          TEXT NOT NULL
                        CHECK (region IN ('Delta', 'Coastal', 'Pine Belt', 'Other')),
    is_delta        INTEGER NOT NULL CHECK (is_delta IN (0, 1)),
    is_rural        INTEGER NOT NULL CHECK (is_rural IN (0, 1)),
    latitude        REAL,
    longitude       REAL
);

-- -----------------------------------------------------------------------------
-- 2. data_sources — provenance metadata for every raw dataset. Lets the README
--    auto-generate a "data sources" section and supports judge Q&A.
-- -----------------------------------------------------------------------------
CREATE TABLE data_sources (
    source_id       TEXT NOT NULL PRIMARY KEY,
    dataset_name    TEXT NOT NULL,
    publisher       TEXT NOT NULL,
    vintage         TEXT NOT NULL,
    release_date    TEXT,
    retrieval_date  TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    local_path      TEXT NOT NULL,
    rows_loaded     INTEGER,
    notes           TEXT
);

-- -----------------------------------------------------------------------------
-- 3. measures — catalog of the 40 PLACES MeasureIds, with composite-membership
--    flag (D-011) and polarity for burden math (Refinement 1: populated for all).
-- -----------------------------------------------------------------------------
CREATE TABLE measures (
    measure_id              TEXT NOT NULL PRIMARY KEY,
    measure_short           TEXT NOT NULL,
    measure_full            TEXT NOT NULL,
    category                TEXT NOT NULL,
    category_id             TEXT,
    data_value_unit         TEXT NOT NULL,
    is_in_burden_composite  INTEGER NOT NULL CHECK (is_in_burden_composite IN (0, 1)),
    polarity                INTEGER NOT NULL CHECK (polarity IN (-1, 1)),
    notes                   TEXT  -- per-measure analytical caveats (Refinement 1)
);

-- -----------------------------------------------------------------------------
-- 4. taxonomies — the 6 HRSA-aligned primary-care provider taxonomies (D-008).
--    Independent reference table so providers/provider_capacity FK into it.
-- -----------------------------------------------------------------------------
CREATE TABLE taxonomies (
    taxonomy_code   TEXT NOT NULL PRIMARY KEY,
    taxonomy_label  TEXT NOT NULL,
    is_primary_care INTEGER NOT NULL DEFAULT 1 CHECK (is_primary_care IN (0, 1))
);

-- -----------------------------------------------------------------------------
-- 5. zcta_county_crosswalk — Census 2020 ZCTA-county intersection rows for MS
--    (D-010). The is_assigned flag pre-computes the largest-population rule
--    so any provider->county join is "WHERE is_assigned = 1".
-- -----------------------------------------------------------------------------
CREATE TABLE zcta_county_crosswalk (
    zcta5           TEXT NOT NULL,
    fips            TEXT NOT NULL,
    county_name     TEXT NOT NULL,
    arealand_zcta   INTEGER,
    arealand_part   INTEGER,
    is_assigned     INTEGER NOT NULL CHECK (is_assigned IN (0, 1)),
    PRIMARY KEY (zcta5, fips),
    FOREIGN KEY (fips) REFERENCES counties(fips)
);

-- -----------------------------------------------------------------------------
-- 6. health_indicators — long-form PLACES facts. PK is 4-col composite so we
--    preserve both Year (2022/2023 mix) and Data_Value_Type (Crude vs Age-adj).
-- -----------------------------------------------------------------------------
CREATE TABLE health_indicators (
    fips             TEXT NOT NULL,
    measure_id       TEXT NOT NULL,
    year             INTEGER NOT NULL CHECK (year BETWEEN 2018 AND 2030),
    data_value_type  TEXT NOT NULL
                         CHECK (data_value_type IN ('Crude prevalence', 'Age-adjusted prevalence')),
    data_value       REAL,                    -- NULL when PLACES suppressed the value
    low_ci           REAL,
    high_ci          REAL,
    total_population INTEGER,
    PRIMARY KEY (fips, measure_id, year, data_value_type),
    FOREIGN KEY (fips)       REFERENCES counties(fips),
    FOREIGN KEY (measure_id) REFERENCES measures(measure_id)
);

-- -----------------------------------------------------------------------------
-- 7. social_vulnerability — SVI 2022 facts, one wide row per county. Holds the
--    5 RPL rankings plus ~15 indicator estimates we use directly in analysis.
--    All RPL_* values are intra-state percentiles (D-007). SVI's -999 missing
--    sentinel must be coerced to NULL at load time (D-014); the CHECK
--    constraints below will hard-fail the load if any -999 slips through.
-- -----------------------------------------------------------------------------
CREATE TABLE social_vulnerability (
    fips                          TEXT NOT NULL PRIMARY KEY,
    svi_year                      INTEGER NOT NULL
                                      CHECK (svi_year BETWEEN 2018 AND 2030),
    rpl_themes                    REAL
                                      CHECK (rpl_themes IS NULL OR rpl_themes BETWEEN 0 AND 1),
    rpl_theme1_socioeconomic      REAL
                                      CHECK (rpl_theme1_socioeconomic IS NULL OR rpl_theme1_socioeconomic BETWEEN 0 AND 1),
    rpl_theme2_household          REAL
                                      CHECK (rpl_theme2_household IS NULL OR rpl_theme2_household BETWEEN 0 AND 1),
    rpl_theme3_minority           REAL
                                      CHECK (rpl_theme3_minority IS NULL OR rpl_theme3_minority BETWEEN 0 AND 1),
    rpl_theme4_housing_transport  REAL
                                      CHECK (rpl_theme4_housing_transport IS NULL OR rpl_theme4_housing_transport BETWEEN 0 AND 1),
    e_totpop                      INTEGER,
    ep_pov150                     REAL CHECK (ep_pov150  IS NULL OR ep_pov150  BETWEEN 0 AND 100),
    ep_unemp                      REAL CHECK (ep_unemp   IS NULL OR ep_unemp   BETWEEN 0 AND 100),
    ep_uninsur                    REAL CHECK (ep_uninsur IS NULL OR ep_uninsur BETWEEN 0 AND 100),
    ep_age65                      REAL CHECK (ep_age65   IS NULL OR ep_age65   BETWEEN 0 AND 100),
    ep_age17                      REAL CHECK (ep_age17   IS NULL OR ep_age17   BETWEEN 0 AND 100),
    ep_disabl                     REAL CHECK (ep_disabl  IS NULL OR ep_disabl  BETWEEN 0 AND 100),
    ep_sngpnt                     REAL CHECK (ep_sngpnt  IS NULL OR ep_sngpnt  BETWEEN 0 AND 100),
    ep_limeng                     REAL CHECK (ep_limeng  IS NULL OR ep_limeng  BETWEEN 0 AND 100),
    ep_minrty                     REAL CHECK (ep_minrty  IS NULL OR ep_minrty  BETWEEN 0 AND 100),
    ep_mobile                     REAL CHECK (ep_mobile  IS NULL OR ep_mobile  BETWEEN 0 AND 100),
    ep_crowd                      REAL CHECK (ep_crowd   IS NULL OR ep_crowd   BETWEEN 0 AND 100),
    ep_noveh                      REAL CHECK (ep_noveh   IS NULL OR ep_noveh   BETWEEN 0 AND 100),
    ep_groupq                     REAL CHECK (ep_groupq  IS NULL OR ep_groupq  BETWEEN 0 AND 100),
    FOREIGN KEY (fips) REFERENCES counties(fips)
);

-- -----------------------------------------------------------------------------
-- 8. providers — one row per NPI (active MS primary-care providers, 6,404 rows).
--    fips is NULLABLE because ~14 NPPES practice ZIPs don't match any MS ZCTA
--    (per D-010 unmatched-ZIP exclusion log). Preserves provenance.
-- -----------------------------------------------------------------------------
CREATE TABLE providers (
    npi                 TEXT NOT NULL PRIMARY KEY CHECK (length(npi) = 10),
    entity_type_code    TEXT CHECK (entity_type_code IN ('1', '2') OR entity_type_code IS NULL),
    last_name           TEXT,
    first_name          TEXT,
    practice_city       TEXT,
    practice_state      TEXT NOT NULL DEFAULT 'MS',
    practice_zip5       TEXT NOT NULL CHECK (length(practice_zip5) = 5),
    practice_zip_full   TEXT,
    fips                TEXT,                  -- NULLABLE: 14 unmatched ZIPs
    taxonomy_code       TEXT NOT NULL,
    enumeration_date    TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    FOREIGN KEY (fips)          REFERENCES counties(fips),
    FOREIGN KEY (taxonomy_code) REFERENCES taxonomies(taxonomy_code)
);

-- -----------------------------------------------------------------------------
-- 9. provider_capacity — pre-aggregated counts per (county, taxonomy). We INSERT
--    a row for every (fips, taxonomy_code) pair, including zero counts, so
--    Phase 3 GROUP BY queries never miss a county-taxonomy combination.
-- -----------------------------------------------------------------------------
CREATE TABLE provider_capacity (
    fips            TEXT NOT NULL,
    taxonomy_code   TEXT NOT NULL,
    provider_count  INTEGER NOT NULL DEFAULT 0 CHECK (provider_count >= 0),
    PRIMARY KEY (fips, taxonomy_code),
    FOREIGN KEY (fips)          REFERENCES counties(fips),
    FOREIGN KEY (taxonomy_code) REFERENCES taxonomies(taxonomy_code)
);

-- =============================================================================
-- Indexes — one per non-PK foreign key + a couple for common predicate columns.
-- (SQLite auto-indexes PRIMARY KEYs, so single-col PKs need no extra index.)
-- =============================================================================

-- health_indicators: most queries filter by fips, measure_id, or year
CREATE INDEX idx_health_indicators_fips        ON health_indicators (fips);
CREATE INDEX idx_health_indicators_measure_id  ON health_indicators (measure_id);
CREATE INDEX idx_health_indicators_year        ON health_indicators (year);

-- providers: county joins and taxonomy filters
CREATE INDEX idx_providers_fips                ON providers (fips);
CREATE INDEX idx_providers_taxonomy_code       ON providers (taxonomy_code);

-- provider_capacity: county lookups (taxonomy is part of PK)
CREATE INDEX idx_provider_capacity_fips        ON provider_capacity (fips);

-- zcta_county_crosswalk: composite for fast "assigned county for this ZCTA"
-- (Refinement 3: regular composite index instead of partial index)
CREATE INDEX idx_zcta_xwalk_fips               ON zcta_county_crosswalk (fips);
CREATE INDEX idx_zcta_xwalk_assigned           ON zcta_county_crosswalk (zcta5, is_assigned);

-- data_sources: occasional filter by publisher
CREATE INDEX idx_data_sources_publisher        ON data_sources (publisher);
