"""
01_load_data.py — Ingest raw MS-filtered CSVs into database.db.

DATA FLOW
=========

Inputs (all under data/raw/ — gitignored, materialized by Phase 1 downloads):
  1. places_county_ms_2025.csv               PLACES long-form, 6,560 rows
  2. svi_county_ms_2022.csv                  SVI per-state file, 82 rows
  3. cms_nppes_ms_primary_care_2026-05.csv   NPPES MS + 6 taxonomies, 6,404 rows
  4. census_acs_county_population_ms_2022.csv  ACS B01003, 82 rows
  5. census_zcta_county_crosswalk_ms_2020.csv  ZCTA <-> county, 771 rows

Output:
  database.db (single SQLite file; schema enforced by schema/create_tables.sql)

Steps in order:
  1. Open SQLite connection with PRAGMA foreign_keys = ON.
  2. Re-create schema by executing schema/create_tables.sql (idempotent).
  3. BEGIN transaction (single commit at the end; rollback on any error).
  4. Load reference tables:
     a. taxonomies  — 6 HRSA-aligned primary-care taxonomy codes (D-008).
     b. counties    — 82 rows; population from ACS, region from D-013,
                      is_rural from population < 50,000, lat/lon from
                      PLACES Geolocation column.
     c. measures    — 40 rows; is_in_burden_composite per D-011,
                      polarity per D-011 (+1 default, -1 for the 6
                      preventive / adherence measures), notes for the
                      4 BRFSS-2022 measures.
  5. Load junction reference:
     d. zcta_county_crosswalk — 771 rows; is_assigned = 1 chosen per ZCTA
        by the largest-population rule (D-010).
  6. Load fact tables:
     e. health_indicators — PLACES, filtered to {Crude, Age-adjusted}.
     f. social_vulnerability — SVI; -999 -> NULL coercion (D-014).
     g. providers — NPPES; fips derived via crosswalk where is_assigned=1
                    (read back from the DB, never recomputed in-memory);
                    fips=NULL for the 14 unmatched practice ZIPs.
  7. Compute aggregated table (pure SQL):
     h. provider_capacity — 492 rows; CROSS JOIN counties x taxonomies,
                            LEFT JOIN providers grouped, COALESCE to 0.
  8. Load metadata last (so rows_loaded is populated with real counts):
     i. data_sources — 5 rows of provenance metadata.
  9. Verify row counts against expected; COMMIT and close.

Exit codes:
  0 — clean load; every table's row count matches expected.
  1 — any row-count mismatch, schema failure, or load exception (rollback).
"""

from __future__ import annotations

import logging
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

# =============================================================================
# Paths
# =============================================================================
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_RAW     = PROJECT_ROOT / "data" / "raw"
SCHEMA_SQL   = PROJECT_ROOT / "schema" / "create_tables.sql"
DB_PATH      = PROJECT_ROOT / "database.db"

PLACES_CSV = DATA_RAW / "places_county_ms_2025.csv"
SVI_CSV    = DATA_RAW / "svi_county_ms_2022.csv"
NPPES_CSV  = DATA_RAW / "cms_nppes_ms_primary_care_2026-05.csv"
ACS_CSV    = DATA_RAW / "census_acs_county_population_ms_2022.csv"
ZCTA_CSV   = DATA_RAW / "census_zcta_county_crosswalk_ms_2020.csv"

# =============================================================================
# Business-rule constants
# =============================================================================
SVI_MISSING_SENTINEL = -999       # D-014
RURAL_POP_THRESHOLD  = 50_000     # D-013 rural proxy (~ USDA non-metro)

# 6 HRSA-aligned primary-care taxonomies (D-008)
TAXONOMIES: list[tuple[str, str]] = [
    ("207Q00000X", "Family Medicine"),
    ("207R00000X", "Internal Medicine"),
    ("208000000X", "Pediatrics"),
    ("207V00000X", "Obstetrics & Gynecology"),
    ("363L00000X", "Nurse Practitioner"),
    ("363A00000X", "Physician Assistant"),
]

# D-013 region definitions. Mississippi Delta Regional Authority's 18-county
# Delta; 3 Gulf Coast counties; conventional 8-county Pine Belt. All other
# counties (~53) -> 'Other'. County names here are the BARE form (no ' County'
# suffix); normalize_county_name() strips the suffix before lookup.
DELTA_COUNTIES = {
    "Bolivar", "Carroll", "Coahoma", "DeSoto", "Holmes", "Humphreys",
    "Issaquena", "Leflore", "Panola", "Quitman", "Sharkey", "Sunflower",
    "Tallahatchie", "Tate", "Tunica", "Warren", "Washington", "Yazoo",
}
COASTAL_COUNTIES = {"Hancock", "Harrison", "Jackson"}
PINE_BELT_COUNTIES = {
    "Forrest", "Lamar", "Marion", "Pearl River",
    "Perry", "Stone", "Walthall", "Wayne",
}

# D-011: the 10 burden-composite measures
BURDEN_COMPOSITE_MEASURES = {
    "DIABETES", "BPHIGH", "OBESITY", "COPD", "CHD",   # chronic disease
    "DEPRESSION", "MHLTH",                            # mental health
    "ACCESS2", "CHECKUP",                             # healthcare access
    "CHOLSCREEN",                                     # prevention
}

# Polarity assignment for all 40 measures (D-011 Refinement 1):
#   -1 = higher value is BETTER for health (we invert these for burden math).
#   +1 = higher value is WORSE for health (the default for outcome / risk measures).
# Six measures get -1: preventive services and treatment-adherence measures
# where a higher prevalence is a positive sign for the population.
POLARITY_NEGATIVE = {
    "BPMED",        # taking BP medication among those with hypertension (good adherence)
    "CHECKUP",      # routine checkup in past year (good access)
    "CHOLSCREEN",   # had cholesterol screening (good prevention)
    "COLON_SCREEN", # colorectal cancer screening received (good prevention)
    "DENTAL",       # visited a dentist in past year (good access)
    "MAMMOUSE",     # mammography use, women 50-74 (good prevention)
}
# All 34 other PLACES measures default to +1 (higher prevalence = worse).
# Includes: ACCESS2 (lack of insurance), ARTHRITIS, BINGE, BPHIGH, CANCER,
# CASTHMA, CHD, COGNITION, COPD, CSMOKING, DEPRESSION, DIABETES, DISABILITY,
# EMOTIONSPT (lack of social/emotional support), FOODINSECU, FOODSTAMP, GHLTH
# (fair/poor general health), HEARING, HIGHCHOL, HOUSINSECU, INDEPLIVE,
# LACKTRPT, LONELINESS, LPA (no leisure physical activity), MHLTH (frequent
# mental distress), MOBILITY, OBESITY, PHLTH, SELFCARE, SHUTUTILITY, SLEEP
# (insufficient), STROKE, TEETHLOST, VISION.

# 4 PLACES measures still published on 2022 BRFSS in the 2025 release; the
# other 36 use 2023 BRFSS. Documented in D-006 amendment.
BRFSS_2022_MEASURES = {"BPHIGH", "BPMED", "CHOLSCREEN", "HIGHCHOL"}
BRFSS_NOTE = ("Year=2022 because BRFSS rotates this question; "
              "4 of 40 measures share this caveat "
              "(BPHIGH, BPMED, CHOLSCREEN, HIGHCHOL).")

# Provenance metadata for the 5 raw datasets (populates data_sources).
# rows_loaded is filled in at the end with actual counts from the load.
DATA_SOURCES: list[dict] = [
    {
        "source_id":      "PLACES_2025",
        "dataset_name":   "PLACES: Local Data for Better Health, County Data",
        "publisher":      "CDC",
        "vintage":        "2023 BRFSS (4 measures still 2022)",
        "release_date":   "2024-12-23",
        "retrieval_date": "2026-05-16",
        "source_url":     "https://data.cdc.gov/api/views/swc5-untb/rows.csv?accessType=DOWNLOAD",
        "local_path":     "data/raw/places_county_ms_2025.csv",
        "notes":          "Filtered to StateAbbr='MS'; long-form per D-006.",
        "row_count_table": "health_indicators",   # which table's row count to record
    },
    {
        "source_id":      "SVI_2022",
        "dataset_name":   "CDC/ATSDR Social Vulnerability Index, County, Mississippi",
        "publisher":      "CDC/ATSDR",
        "vintage":        "2022 (uses 2018-2022 ACS inputs)",
        "release_date":   "2024-05-17",
        "retrieval_date": "2026-05-16",
        "source_url":     "https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/Mississippi_COUNTY.csv",
        "local_path":     "data/raw/svi_county_ms_2022.csv",
        "notes":          "Intra-state percentiles (D-007); -999 sentinels coerced to NULL (D-014).",
        "row_count_table": "social_vulnerability",
    },
    {
        "source_id":      "NPPES_2026_05",
        "dataset_name":   "CMS NPPES Data Dissemination, May 2026 monthly",
        "publisher":      "CMS",
        "vintage":        "May 2026 monthly snapshot",
        "release_date":   "2026-05-11",
        "retrieval_date": "2026-05-16",
        "source_url":     "https://download.cms.gov/nppes/NPPES_Data_Dissemination_May_2026_V2.zip",
        "local_path":     "data/raw/cms_nppes_ms_primary_care_2026-05.csv",
        "notes":          "Filtered to MS + 6 HRSA primary-care taxonomies (D-008); national file deleted post-filter.",
        "row_count_table": "providers",
    },
    {
        "source_id":      "ACS_2022_5YR",
        "dataset_name":   "American Community Survey 5-Year Estimates (B01003 total population)",
        "publisher":      "U.S. Census Bureau",
        "vintage":        "2018-2022 5-year",
        "release_date":   "2023-12-07",
        "retrieval_date": "2026-05-16",
        "source_url":     "https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=county:*&in=state:28",
        "local_path":     "data/raw/census_acs_county_population_ms_2022.csv",
        "notes":          "API call via CENSUS_API_KEY from .env (D-009).",
        "row_count_table": "counties",
    },
    {
        "source_id":      "ZCTA_XWALK_2020",
        "dataset_name":   "2020 Census ZCTA-County Relationship File (MS subset)",
        "publisher":      "U.S. Census Bureau",
        "vintage":        "2020 decennial Census geographies",
        "release_date":   "2021-08-12",
        "retrieval_date": "2026-05-16",
        "source_url":     "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
        "local_path":     "data/raw/census_zcta_county_crosswalk_ms_2020.csv",
        "notes":          "Filtered to MS county FIPS 28xxx; D-010 largest-population assignment computed at load.",
        "row_count_table": "zcta_county_crosswalk",
    },
]

# Expected row counts (validated at end of load; mismatch -> exit 1).
EXPECTED_ROW_COUNTS = {
    "counties":              82,
    "data_sources":           5,
    "taxonomies":             6,
    "measures":              40,
    "zcta_county_crosswalk": 771,
    "health_indicators":   6_560,
    "social_vulnerability":  82,
    "providers":           6_404,
    "provider_capacity":     492,   # 82 counties * 6 taxonomies
}

# =============================================================================
# Logging
# =============================================================================
logger = logging.getLogger("load_data")

def configure_logging() -> None:
    """Configure module logger to stdout with a single-line format."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )

# =============================================================================
# Cleaning helpers (each does one thing, all are pure)
# =============================================================================
_GEO_RE = re.compile(r"POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)")

def extract_lat_lon(geolocation) -> tuple[float | None, float | None]:
    """Parse PLACES Geolocation 'POINT (lon lat)' -> (lat, lon) floats.
    Returns (None, None) if the value cannot be parsed."""
    if not isinstance(geolocation, str):
        return None, None
    m = _GEO_RE.search(geolocation)
    if not m:
        return None, None
    lon, lat = float(m.group(1)), float(m.group(2))
    return lat, lon

def pad_fips(value) -> str:
    """Coerce a FIPS to 5-digit zero-padded string. Raises ValueError on NaN
    or non-digit input. Never let pandas auto-cast FIPS to int — that loses
    leading zeros. Handles the '28049.0' float case that arises when a
    column was read as float."""
    if pd.isna(value):
        raise ValueError("FIPS cannot be NaN/None")
    s = str(value).strip()
    if s.lower() == "nan":
        raise ValueError(f"FIPS cannot be NaN string: {value!r}")
    if s.endswith(".0"):
        s = s[:-2]
    if not s.isdigit():
        raise ValueError(f"FIPS must be numeric, got: {value!r}")
    return s.zfill(5)

def pad_zip5(value) -> str:
    """Slice a ZIP+4 (9-char) or 5-char ZIP to a clean 5-digit string."""
    s = str(value).strip()
    if s.endswith(".0"):
        s = s[:-2]
    s = s[:5]
    return s.zfill(5)

def normalize_county_name(name: str) -> str:
    """Trim ' County' / ', Mississippi' suffixes for set lookups against
    DELTA_COUNTIES / COASTAL_COUNTIES / PINE_BELT_COUNTIES.

    ACS publishes 'Hinds County, Mississippi'; SVI publishes 'Hinds County';
    PLACES publishes 'Hinds'. All three normalize to 'Hinds'."""
    s = str(name).strip()
    for suffix in (", Mississippi", " County"):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    return s.strip()

def assign_region(county_name: str) -> str:
    """Map a county short name (e.g. 'Hinds') to one of the 4 D-013 regions."""
    bare = normalize_county_name(county_name)
    if bare in DELTA_COUNTIES:
        return "Delta"
    if bare in COASTAL_COUNTIES:
        return "Coastal"
    if bare in PINE_BELT_COUNTIES:
        return "Pine Belt"
    return "Other"

def polarity_for(measure_id: str) -> int:
    """+1 default; -1 for the 6 preventive/adherence measures (D-011)."""
    return -1 if measure_id in POLARITY_NEGATIVE else 1

def notes_for(measure_id: str) -> str | None:
    """Per-measure note; currently only the 4 BRFSS-2022 measures get one."""
    return BRFSS_NOTE if measure_id in BRFSS_2022_MEASURES else None

def coerce_svi_number(v):
    """SVI -999 sentinel -> Python None (lands as SQL NULL). NaN -> None too.
    Anything else returned as float. CHECK constraints on social_vulnerability
    catch any -999 that slips through (D-014 tripwire)."""
    if pd.isna(v):
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n == SVI_MISSING_SENTINEL:
        return None
    return n

def to_iso_date(s):
    """Best-effort date normalizer for NPPES enumeration_date.
    Tries MM/DD/YYYY then YYYY-MM-DD; returns the original string if neither
    matches (we preserve, don't drop)."""
    if pd.isna(s):
        return None
    s = str(s).strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return s

# =============================================================================
# Connection + schema
# =============================================================================
def connect(db_path: Path) -> sqlite3.Connection:
    """Open SQLite, enable FK enforcement, return the connection."""
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON;")
    pragma = conn.execute("PRAGMA foreign_keys;").fetchone()[0]
    if pragma != 1:
        raise RuntimeError("Failed to enable PRAGMA foreign_keys")
    return conn

def run_schema(conn: sqlite3.Connection, sql_path: Path) -> None:
    """Idempotently (re)create the entire schema by executing the .sql file.
    executescript() runs ALL statements in the file (DROPs + CREATEs + indexes)."""
    logger.info(f"executing schema: {sql_path.relative_to(PROJECT_ROOT)}")
    sql = sql_path.read_text()
    conn.executescript(sql)
    # executescript() auto-commits and re-disables FKs in some sqlite versions;
    # re-enable explicitly so subsequent INSERTs validate referential integrity.
    conn.execute("PRAGMA foreign_keys = ON;")

# =============================================================================
# Load functions (one per table, each returns the inserted row count)
# =============================================================================
def load_taxonomies(conn: sqlite3.Connection) -> int:
    """Insert the 6 HRSA primary-care taxonomies."""
    rows = [(code, label, 1) for code, label in TAXONOMIES]
    conn.executemany(
        "INSERT INTO taxonomies (taxonomy_code, taxonomy_label, is_primary_care) VALUES (?,?,?)",
        rows,
    )
    n = len(rows)
    logger.info(f"loaded taxonomies: {n} rows")
    return n

def load_counties(conn: sqlite3.Connection,
                  acs_df: pd.DataFrame,
                  places_df: pd.DataFrame) -> int:
    """Build 82-row counties table: fips/name/pop from ACS, centroid from
    PLACES Geolocation, region/is_delta/is_rural derived."""
    # One representative Geolocation per FIPS (any row works; PLACES gives
    # the same POINT for every row of the same county).
    centroids = (
        places_df[["LocationID", "Geolocation"]]
        .drop_duplicates(subset="LocationID")
        .set_index("LocationID")["Geolocation"]
        .to_dict()
    )
    rows = []
    for _, r in acs_df.iterrows():
        fips = pad_fips(r["fips"])
        full_name = str(r["county_name"]).strip()       # 'Hinds County, Mississippi'
        # Canonical name in DB: 'Hinds County' (strip the ', Mississippi' tail)
        county_name = full_name.split(",")[0].strip()
        population = int(r["population"])
        region = assign_region(county_name)
        is_delta = 1 if region == "Delta" else 0
        is_rural = 1 if population < RURAL_POP_THRESHOLD else 0
        lat, lon = extract_lat_lon(centroids.get(fips))
        rows.append((
            fips, county_name, "28", "MS",
            population, region, is_delta, is_rural, lat, lon,
        ))
    conn.executemany(
        """INSERT INTO counties
           (fips, county_name, state_fips, state_abbr, population, region,
            is_delta, is_rural, latitude, longitude)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    missing_centroids = sum(1 for r in rows if r[8] is None or r[9] is None)
    logger.info(f"loaded counties: {n} rows  (centroids missing: {missing_centroids})")
    return n

def load_measures(conn: sqlite3.Connection, places_df: pd.DataFrame) -> int:
    """Build 40-row measures catalog from the PLACES distinct MeasureIds."""
    cat = (
        places_df[["MeasureId", "Short_Question_Text", "Measure", "Category",
                   "CategoryID", "Data_Value_Unit"]]
        .drop_duplicates(subset="MeasureId")
        .sort_values("MeasureId")
    )
    rows = []
    for _, r in cat.iterrows():
        mid = str(r["MeasureId"]).strip()
        rows.append((
            mid,
            str(r["Short_Question_Text"]).strip(),
            str(r["Measure"]).strip(),
            str(r["Category"]).strip(),
            str(r["CategoryID"]).strip() if pd.notna(r["CategoryID"]) else None,
            str(r["Data_Value_Unit"]).strip(),
            1 if mid in BURDEN_COMPOSITE_MEASURES else 0,
            polarity_for(mid),
            notes_for(mid),
        ))
    conn.executemany(
        """INSERT INTO measures
           (measure_id, measure_short, measure_full, category, category_id,
            data_value_unit, is_in_burden_composite, polarity, notes)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    in_burden = sum(1 for r in rows if r[6] == 1)
    neg_pol   = sum(1 for r in rows if r[7] == -1)
    logger.info(f"loaded measures: {n} rows  (in burden composite: {in_burden}, "
                f"polarity=-1: {neg_pol})")
    return n

def load_zcta_crosswalk(conn: sqlite3.Connection, zcta_df: pd.DataFrame) -> int:
    """Insert MS ZCTA-county intersection rows. is_assigned = 1 on the single
    row per ZCTA where the ZCTA's physical LAND AREA in that county is
    greatest (D-010 AMENDED).

    The ORIGINAL rule (largest-population county per ZCTA) systematically
    under-attributed providers in smaller counties whose ZCTAs were shared
    with larger neighbors. Discovered via q03 review: 16 of 82 counties
    showed zero attributed providers, e.g. Clay County (pop 18,598) losing
    its own county-seat ZIP 39773 (West Point) to Monroe County because
    Monroe had a larger population. The AMENDED rule uses AREALAND_PART —
    the physical land-area overlap between a ZCTA and a county — as the
    more direct geographic measure of where a ZCTA actually sits."""
    # Census-native column names -> canonical schema names.
    # Defensive: the Phase 1 export lowercased zcta5/fips/county_name but
    # left the rest in Census uppercase. Map all to canonical here so the
    # rest of this function (and any future caller) sees consistent names.
    # AREAWATER_* and AREALAND_COUNTY_20 are intentionally not mapped:
    # the schema doesn't include them. Any unmapped columns flow through
    # pandas untouched.
    df = zcta_df.rename(columns={
        "AREALAND_ZCTA5_20": "arealand_zcta",
        "AREALAND_PART":     "arealand_part",
    })

    df["zcta5"] = df["zcta5"].map(pad_zip5)
    df["fips"]  = df["fips"].map(pad_fips)

    # D-010 AMENDED: assign each ZCTA to the county where its land area
    # overlap is largest, NOT the county with the largest population.
    # Treat NULL arealand_part as 0 (no overlap) for the comparison.
    df["arealand_part_num"] = df["arealand_part"].fillna(0).astype("int64")
    idx_largest_area = df.groupby("zcta5")["arealand_part_num"].idxmax()
    assigned_keys = set(zip(df.loc[idx_largest_area, "zcta5"],
                             df.loc[idx_largest_area, "fips"]))

    rows = []
    multi_county = (df.groupby("zcta5").size() > 1).sum()
    for _, r in df.iterrows():
        key = (r["zcta5"], r["fips"])
        rows.append((
            r["zcta5"], r["fips"], str(r["county_name"]).strip(),
            int(r["arealand_zcta"]) if pd.notna(r["arealand_zcta"]) else None,
            int(r["arealand_part"]) if pd.notna(r["arealand_part"]) else None,
            1 if key in assigned_keys else 0,
        ))
    conn.executemany(
        """INSERT INTO zcta_county_crosswalk
           (zcta5, fips, county_name, arealand_zcta, arealand_part, is_assigned)
           VALUES (?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    n_assigned = sum(1 for r in rows if r[5] == 1)
    logger.info(f"loaded zcta_county_crosswalk: {n} rows  "
                f"(unique ZCTAs assigned: {n_assigned}; multi-county ZCTAs: {multi_county})")
    return n

def load_health_indicators(conn: sqlite3.Connection, places_df: pd.DataFrame) -> int:
    """Long-form PLACES facts. Drop any rows where data_value_type is neither
    'Crude prevalence' nor 'Age-adjusted prevalence' (other variants like
    'Mean' exist for some measures and aren't part of our analytical model)."""
    valid_types = {"Crude prevalence", "Age-adjusted prevalence"}
    df = places_df[places_df["Data_Value_Type"].isin(valid_types)].copy()
    dropped = len(places_df) - len(df)
    if dropped:
        logger.info(f"  health_indicators: dropped {dropped} non-prevalence rows")

    def num_or_none(v):
        return None if pd.isna(v) else float(v)
    def int_or_none(v):
        return None if pd.isna(v) else int(v)

    rows = []
    for _, r in df.iterrows():
        rows.append((
            pad_fips(r["LocationID"]),
            str(r["MeasureId"]).strip(),
            int(r["Year"]),
            str(r["Data_Value_Type"]).strip(),
            num_or_none(r["Data_Value"]),
            num_or_none(r["Low_Confidence_Limit"]),
            num_or_none(r["High_Confidence_Limit"]),
            int_or_none(r["TotalPopulation"]),
        ))
    conn.executemany(
        """INSERT INTO health_indicators
           (fips, measure_id, year, data_value_type,
            data_value, low_ci, high_ci, total_population)
           VALUES (?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    nulls = sum(1 for r in rows if r[4] is None)
    logger.info(f"loaded health_indicators: {n} rows  (suppressed data_value: {nulls})")
    return n

def load_social_vulnerability(conn: sqlite3.Connection, svi_df: pd.DataFrame) -> int:
    """One row per county; coerce -999 to NULL per D-014."""
    # Column mapping: source SVI col -> target schema col
    rpl_cols = {
        "RPL_THEMES":  "rpl_themes",
        "RPL_THEME1":  "rpl_theme1_socioeconomic",
        "RPL_THEME2":  "rpl_theme2_household",
        "RPL_THEME3":  "rpl_theme3_minority",
        "RPL_THEME4":  "rpl_theme4_housing_transport",
    }
    ep_cols = [
        "EP_POV150", "EP_UNEMP", "EP_UNINSUR", "EP_AGE65", "EP_AGE17",
        "EP_DISABL", "EP_SNGPNT", "EP_LIMENG", "EP_MINRTY", "EP_MOBILE",
        "EP_CROWD", "EP_NOVEH", "EP_GROUPQ",
    ]
    rows = []
    coerced_total = 0
    for _, r in svi_df.iterrows():
        rec = {
            "fips":     pad_fips(r["STCNTY"]),
            "svi_year": 2022,
            "e_totpop": int(r["E_TOTPOP"]) if pd.notna(r["E_TOTPOP"]) else None,
        }
        # Track -999 occurrences for logging
        for src in list(rpl_cols.keys()) + ep_cols:
            v = r.get(src)
            try:
                if float(v) == SVI_MISSING_SENTINEL:
                    coerced_total += 1
            except (TypeError, ValueError):
                pass
        for src, dst in rpl_cols.items():
            rec[dst] = coerce_svi_number(r.get(src))
        for src in ep_cols:
            rec[src.lower()] = coerce_svi_number(r.get(src))
        rows.append(tuple(rec[k] for k in [
            "fips", "svi_year",
            "rpl_themes", "rpl_theme1_socioeconomic", "rpl_theme2_household",
            "rpl_theme3_minority", "rpl_theme4_housing_transport",
            "e_totpop",
            "ep_pov150", "ep_unemp", "ep_uninsur", "ep_age65", "ep_age17",
            "ep_disabl", "ep_sngpnt", "ep_limeng", "ep_minrty", "ep_mobile",
            "ep_crowd", "ep_noveh", "ep_groupq",
        ]))
    conn.executemany(
        """INSERT INTO social_vulnerability
           (fips, svi_year,
            rpl_themes, rpl_theme1_socioeconomic, rpl_theme2_household,
            rpl_theme3_minority, rpl_theme4_housing_transport,
            e_totpop,
            ep_pov150, ep_unemp, ep_uninsur, ep_age65, ep_age17,
            ep_disabl, ep_sngpnt, ep_limeng, ep_minrty, ep_mobile,
            ep_crowd, ep_noveh, ep_groupq)
           VALUES (?,?, ?,?,?,?,?, ?, ?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    logger.info(f"loaded social_vulnerability: {n} rows  "
                f"(-999 sentinels coerced to NULL: {coerced_total})")
    return n

def load_providers(conn: sqlite3.Connection,
                   nppes_df: pd.DataFrame) -> int:
    """Insert one row per active NPI. Derive fips via the
    zcta_county_crosswalk table (where is_assigned = 1) — single source of
    truth. Unmatched ZIPs (the 14 known PO-box / out-of-state cases per
    D-010) get fips=NULL and are logged with explicit reason."""
    # Single source of truth for ZIP -> assigned-FIPS lookup: the DB.
    # Avoids drift between the in-memory rule applied at zcta load time
    # and any duplicate computation here.
    assigned = dict(
        conn.execute(
            "SELECT zcta5, fips FROM zcta_county_crosswalk WHERE is_assigned = 1"
        ).fetchall()
    )
    rows = []
    unmatched_zips: set[str] = set()
    for _, r in nppes_df.iterrows():
        zip_full = str(r["Provider Business Practice Location Address Postal Code"]).strip()
        zip5 = pad_zip5(zip_full)
        fips = assigned.get(zip5)         # None if unmatched -> SQL NULL
        if fips is None:
            unmatched_zips.add(zip5)
        rows.append((
            str(r["NPI"]).strip(),
            (str(r["Entity Type Code"]).strip() if pd.notna(r["Entity Type Code"]) else None),
            (str(r["Provider Last Name (Legal Name)"]).strip() if pd.notna(r["Provider Last Name (Legal Name)"]) else None),
            (str(r["Provider First Name"]).strip() if pd.notna(r["Provider First Name"]) else None),
            (str(r["Provider Business Practice Location Address City Name"]).strip() if pd.notna(r["Provider Business Practice Location Address City Name"]) else None),
            "MS",
            zip5,
            zip_full if zip_full else None,
            fips,
            str(r["matched_taxonomy_code"]).strip(),
            to_iso_date(r.get("Provider Enumeration Date")),
            1,                       # is_active (filtered upstream)
        ))
    conn.executemany(
        """INSERT INTO providers
           (npi, entity_type_code, last_name, first_name,
            practice_city, practice_state, practice_zip5, practice_zip_full,
            fips, taxonomy_code, enumeration_date, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    n_unmatched_rows = sum(1 for r in rows if r[8] is None)
    logger.info(
        f"loaded providers: {n} rows  "
        f"(fips=NULL for {n_unmatched_rows} providers across "
        f"{len(unmatched_zips)} unmatched ZIPs: "
        "PO-box-only ZIPs not enumerated as ZCTAs + 1 AL border ZIP + 1 likely FL typo)"
    )
    return n

def populate_provider_capacity(conn: sqlite3.Connection) -> int:
    """Build 492 = 82 * 6 rows via pure SQL: cross join counties x taxonomies,
    LEFT JOIN aggregated provider counts, COALESCE missing combos to 0."""
    conn.execute(
        """INSERT INTO provider_capacity (fips, taxonomy_code, provider_count)
           SELECT c.fips, t.taxonomy_code, COALESCE(p.cnt, 0) AS provider_count
           FROM counties c
           CROSS JOIN taxonomies t
           LEFT JOIN (
               SELECT fips, taxonomy_code, COUNT(*) AS cnt
               FROM providers
               WHERE fips IS NOT NULL
               GROUP BY fips, taxonomy_code
           ) p
             ON p.fips = c.fips AND p.taxonomy_code = t.taxonomy_code"""
    )
    n = conn.execute("SELECT COUNT(*) FROM provider_capacity").fetchone()[0]
    zero_count = conn.execute(
        "SELECT COUNT(*) FROM provider_capacity WHERE provider_count = 0"
    ).fetchone()[0]
    logger.info(f"populated provider_capacity: {n} rows  (zero-count cells: {zero_count})")
    return n

def load_data_sources(conn: sqlite3.Connection, row_counts: dict[str, int]) -> int:
    """Insert 5 provenance rows. Each carries rows_loaded copied from the
    relevant fact/reference table count gathered earlier in the load."""
    rows = []
    for s in DATA_SOURCES:
        loaded = row_counts.get(s["row_count_table"])
        logger.info(f"  data_sources: {s['source_id']:18s} "
                    f"-> rows_loaded={loaded} (from {s['row_count_table']})")
        rows.append((
            s["source_id"], s["dataset_name"], s["publisher"], s["vintage"],
            s["release_date"], s["retrieval_date"], s["source_url"],
            s["local_path"], loaded, s["notes"],
        ))
    conn.executemany(
        """INSERT INTO data_sources
           (source_id, dataset_name, publisher, vintage, release_date,
            retrieval_date, source_url, local_path, rows_loaded, notes)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    n = len(rows)
    logger.info(f"loaded data_sources: {n} rows")
    return n

# =============================================================================
# Verification
# =============================================================================
def verify_row_counts(conn: sqlite3.Connection) -> tuple[bool, list[tuple]]:
    """Compare actual row counts to EXPECTED_ROW_COUNTS. Returns (all_ok, report)
    where report is a list of (table, actual, expected, status) tuples."""
    rows = []
    all_ok = True
    for table, expected in EXPECTED_ROW_COUNTS.items():
        actual = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        ok = (actual == expected)
        if not ok:
            all_ok = False
        rows.append((table, actual, expected, "OK" if ok else "MISMATCH"))
    return all_ok, rows

def print_summary(report: list[tuple]) -> None:
    """Pretty-print the row-count summary table to stdout."""
    print()
    print("=" * 70)
    print(f"{'TABLE':<25} {'ACTUAL':>10} {'EXPECTED':>10} {'STATUS':>10}")
    print("-" * 70)
    for table, actual, expected, status in report:
        print(f"{table:<25} {actual:>10,d} {expected:>10,d} {status:>10}")
    print("=" * 70)

# =============================================================================
# Main
# =============================================================================
def main() -> int:
    configure_logging()
    logger.info("=== 01_load_data.py starting ===")
    logger.info(f"project root: {PROJECT_ROOT}")
    logger.info(f"database:     {DB_PATH}")

    # Read all 5 raw CSVs upfront — fail fast if any is missing.
    logger.info("reading raw CSVs")
    places_df = pd.read_csv(PLACES_CSV, dtype={"LocationID": str})
    svi_df    = pd.read_csv(SVI_CSV,    dtype={"STCNTY": str, "FIPS": str})
    nppes_df  = pd.read_csv(NPPES_CSV,  dtype=str)
    acs_df    = pd.read_csv(ACS_CSV,    dtype={"fips": str, "state": str, "county": str})
    zcta_df   = pd.read_csv(ZCTA_CSV,   dtype={"zcta5": str, "fips": str})
    logger.info(f"  PLACES: {len(places_df):,} rows")
    logger.info(f"  SVI:    {len(svi_df):,} rows")
    logger.info(f"  NPPES:  {len(nppes_df):,} rows")
    logger.info(f"  ACS:    {len(acs_df):,} rows")
    logger.info(f"  ZCTA:   {len(zcta_df):,} rows")

    conn = connect(DB_PATH)
    try:
        run_schema(conn, SCHEMA_SQL)

        counts: dict[str, int] = {}
        # ---- Reference tables (order matters: taxonomies before providers,
        #      counties before zcta_xwalk, measures before health_indicators) ----
        counts["taxonomies"]              = load_taxonomies(conn)
        counts["counties"]                = load_counties(conn, acs_df, places_df)
        counts["measures"]                = load_measures(conn, places_df)

        # ---- Junction reference (depends on counties.population for is_assigned) ----
        counts["zcta_county_crosswalk"]   = load_zcta_crosswalk(conn, zcta_df)

        # ---- Fact tables ----
        counts["health_indicators"]       = load_health_indicators(conn, places_df)
        counts["social_vulnerability"]    = load_social_vulnerability(conn, svi_df)
        # Providers reads the assigned ZIP->FIPS lookup back from the
        # zcta_county_crosswalk table — single source of truth, no in-memory
        # recomputation. Refactor per Fix 1 to eliminate drift risk.
        counts["providers"]               = load_providers(conn, nppes_df)

        # ---- Aggregated table (pure SQL CROSS JOIN + LEFT JOIN) ----
        counts["provider_capacity"]       = populate_provider_capacity(conn)

        # ---- Metadata last so rows_loaded is real ----
        counts["data_sources"]            = load_data_sources(conn, counts)

        # ---- Verify and commit ----
        all_ok, report = verify_row_counts(conn)
        print_summary(report)
        if not all_ok:
            logger.error("row count mismatch -- rolling back")
            conn.rollback()
            return 1

        conn.commit()
        logger.info("=== COMMIT successful. Database is loaded. ===")
        return 0
    except Exception:
        logger.exception("load failed; rolling back")
        conn.rollback()
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    sys.exit(main())
