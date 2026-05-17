# Data Dictionary — `database.db`

> Judge-facing reference for every table and every column in the Mississippi
> Health Equity Gap Index database. All tables are created by
> `schema/create_tables.sql` and populated by `python/01_load_data.py`. The
> rationale behind each design choice lives in `DECISIONS.md`; the cleaning
> workflow narrative lives in `docs/data_cleaning_report.md`.

## Tables

1. [`counties`](#1-counties) — the 82 MS counties (reference hub)
2. [`data_sources`](#2-data_sources) — provenance for the 5 raw datasets
3. [`measures`](#3-measures) — PLACES MeasureId catalog (40 rows)
4. [`taxonomies`](#4-taxonomies) — the 6 primary-care taxonomies
5. [`zcta_county_crosswalk`](#5-zcta_county_crosswalk) — ZCTA → county mapping
6. [`health_indicators`](#6-health_indicators) — long-form PLACES facts
7. [`social_vulnerability`](#7-social_vulnerability) — SVI 2022 facts
8. [`providers`](#8-providers) — one row per NPI
9. [`provider_capacity`](#9-provider_capacity) — pre-aggregated provider counts

## Cross-table conventions

- **FIPS** is a 5-character zero-padded county code (state FIPS + county FIPS).
  Mississippi's state FIPS is `28`, so every FIPS value in this database starts
  with `28`. Examples: `28049` (Hinds), `28001` (Adams), `28163` (Yazoo).
- **Boolean** columns are stored as `INTEGER` with values 0 or 1 and
  CHECK-constrained accordingly. SQLite has no native boolean type.
- **NULL** is the explicit representation of "unknown" or "suppressed". All
  numeric columns that accept NULL have a CHECK constraint of the form
  `col IS NULL OR (col BETWEEN <lo> AND <hi>)` to permit NULL while rejecting
  out-of-range numeric garbage (especially the SVI `-999` sentinel — see D-014).
- **Foreign keys are enforced.** SQLite does not enforce FKs by default; the
  loader sets `PRAGMA foreign_keys = ON` on every connection, and so should
  any script that writes to the database.

## Quick verification

Anyone unboxing this project can open the database from the shell and
sanity-check it in under 30 seconds:

```sql
-- Open the database
sqlite3 database.db

-- Enable foreign key enforcement on this connection
PRAGMA foreign_keys = ON;

-- Sanity check — county count should be 82
SELECT COUNT(*) AS county_count FROM counties;

-- Provider total per county (top 5 by total primary-care providers)
SELECT c.county_name, SUM(pc.provider_count) AS total_primary_care
FROM counties c
LEFT JOIN provider_capacity pc ON pc.fips = c.fips
GROUP BY c.fips, c.county_name
ORDER BY total_primary_care DESC
LIMIT 5;
```

---

## 1. `counties`

**Purpose.** The reference hub. One row per Mississippi county (n = 82). Every
fact table joins back here via `fips`.

**Rural flag note.** `is_rural` uses a population-based proxy: `is_rural = 1`
if `population < 50,000`, else `0`. The 50,000 threshold approximates the
USDA's non-metro definition (RUCC codes 4–9 are non-metro). We do not load
the actual USDA Rural-Urban Continuum Codes file because it would add a fifth
data download for marginal analytical gain on an 82-county scope. **Upgrade
path:** future work can replace the proxy with the actual RUCC file from
`https://www.ers.usda.gov/data-products/rural-urban-continuum-codes/` and
join on FIPS; the data dictionary should be updated at that time.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `fips` | TEXT | NO | 5-char county FIPS (state + county) | — | `28049` | derived | Always `28xxx`; PK |
| `county_name` | TEXT | NO | Official county name as published by Census | — | `Hinds County` | Census ACS | as-loaded |
| `state_fips` | TEXT | NO | State FIPS portion | — | `28` | derived | constant `28` |
| `state_abbr` | TEXT | NO | State abbreviation | — | `MS` | derived | constant `MS` |
| `population` | INTEGER | NO | Total population estimate | persons | `226541` | Census ACS B01003 (D-009) | 2018–2022 5-year estimate |
| `region` | TEXT | NO | Region partition | — | `Delta` | curated (D-013) | One of: `Delta` / `Coastal` / `Pine Belt` / `Other` |
| `is_delta` | INTEGER | NO | Delta-region flag | 0 or 1 | `1` | derived from `region` | `1` iff `region = 'Delta'` |
| `is_rural` | INTEGER | NO | Rural population flag | 0 or 1 | `0` | derived | `1` iff `population < 50,000` |
| `latitude` | REAL | YES | County centroid latitude | degrees | `32.293` | PLACES `Geolocation` | parsed from `POINT(lon lat)` |
| `longitude` | REAL | YES | County centroid longitude | degrees | `-90.215` | PLACES `Geolocation` | parsed from `POINT(lon lat)` |

---

## 2. `data_sources`

**Purpose.** Provenance metadata for every raw dataset that was loaded into
this database. Lets the README and presentation enumerate inputs directly
from a SQL query, and supports judge Q&A ("which version did you use?").

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `source_id` | TEXT | NO | Stable identifier for the dataset version | — | `PLACES_2025` | curated | PK |
| `dataset_name` | TEXT | NO | Human-readable dataset name | — | `PLACES: Local Data for Better Health, County Data` | from publisher | as-published |
| `publisher` | TEXT | NO | Issuing agency | — | `CDC` | curated | one of CDC / CMS / Census |
| `vintage` | TEXT | NO | Reference period of the data | — | `2023 BRFSS` | publisher metadata | free text |
| `release_date` | TEXT | YES | When the publisher released this file | YYYY-MM-DD | `2024-12-23` | publisher metadata | optional |
| `retrieval_date` | TEXT | NO | When we downloaded it | YYYY-MM-DD | `2026-05-16` | derived | always set |
| `source_url` | TEXT | NO | Direct download URL | — | `https://data.cdc.gov/api/views/swc5-untb/rows.csv?accessType=DOWNLOAD` | curated | URL pinned in DECISIONS.md |
| `local_path` | TEXT | NO | Path under `data/raw/` after pipeline runs | — | `data/raw/places_county_ms_2025.csv` | derived | MS-filtered subset |
| `rows_loaded` | INTEGER | YES | Row count loaded into the database from this source | rows | `6560` | derived | computed at load time |
| `notes` | TEXT | YES | Any source-specific caveats | — | `Filtered to StateAbbr='MS'; long-form per D-006` | curated | free text |

---

## 3. `measures`

**Purpose.** Catalog of every PLACES `MeasureId` we loaded (40 rows). Each
measure carries (a) a flag for whether it participates in the burden composite
(per D-011), and (b) a polarity sign that orients its contribution to the
burden math.

**Polarity semantics.** `polarity = +1` means *higher value = worse health*
(e.g., higher `DIABETES` prevalence means more disease burden).
`polarity = -1` means *higher value = better health* — used for the preventive
services (`CHECKUP`, `CHOLSCREEN`, `COLON_SCREEN`, `DENTAL`, `MAMMOUSE`) and
treatment-adherence measures (`BPMED`). The burden math multiplies each
component's value by its polarity before normalizing, so all burden inputs
point in the same "more = worse" direction.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `measure_id` | TEXT | NO | PLACES short measure code | — | `DIABETES` | PLACES `MeasureId` | PK |
| `measure_short` | TEXT | NO | Short human-readable label | — | `Diabetes` | PLACES `Short_Question_Text` | as-loaded |
| `measure_full` | TEXT | NO | Full measure description | — | `Diagnosed diabetes among adults` | PLACES `Measure` | as-loaded |
| `category` | TEXT | NO | High-level domain | — | `Health Outcomes` | PLACES `Category` | one of 6 PLACES categories |
| `category_id` | TEXT | YES | PLACES category short code | — | `HLTHOUT` | PLACES `CategoryID` | as-loaded |
| `data_value_unit` | TEXT | NO | Unit of `data_value` | — | `%` | PLACES `Data_Value_Unit` | as-loaded (always `%` for PLACES) |
| `is_in_burden_composite` | INTEGER | NO | Composite-membership flag | 0 or 1 | `1` | curated (D-011) | `1` for the 10 burden measures, else `0` |
| `polarity` | INTEGER | NO | Direction sign for burden math | -1 or +1 | `+1` | curated (D-011) | -1 for preventive/adherence measures, +1 otherwise |
| `notes` | TEXT | YES | Per-measure analytical caveat | — | `Year=2022 because BRFSS rotates this question; 4 of 40 measures share this caveat` | curated | populated for measures with caveats |

---

## 4. `taxonomies`

**Purpose.** Reference table for the 6 HRSA-aligned primary-care provider
taxonomies we filtered NPPES to (per D-008). Joined by `providers` and
`provider_capacity`.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `taxonomy_code` | TEXT | NO | NUCC taxonomy code | — | `207Q00000X` | NUCC standard | PK |
| `taxonomy_label` | TEXT | NO | Human-readable label | — | `Family Medicine` | NUCC standard | as-loaded |
| `is_primary_care` | INTEGER | NO | Primary care flag | 0 or 1 | `1` | curated (D-008) | always `1` in current load; column reserved for future specialty additions |

Seeded rows:

| code | label |
|---|---|
| `207Q00000X` | Family Medicine |
| `207R00000X` | Internal Medicine |
| `208000000X` | Pediatrics |
| `207V00000X` | Obstetrics & Gynecology |
| `363L00000X` | Nurse Practitioner |
| `363A00000X` | Physician Assistant |

---

## 5. `zcta_county_crosswalk`

**Purpose.** ZIP-to-county mapping derived from the Census 2020 ZCTA-County
Relationship File (D-010). Used by the loader to attribute each NPPES
provider's practice ZIP to a county.

**Largest-population assignment rule and audit trail.** Of the 428 MS ZCTAs,
**230 span multiple counties** (54%). Per D-010, each ZCTA is assigned to a
single county for provider attribution: the county among those it touches
with the **largest population** (sourced from Census ACS B01003, the same
populations stored in `counties.population`). Reasoning: NPPES practice
addresses are point locations, and the population-largest county is the
highest-probability physical-practice county for a provider whose ZIP crosses
county lines. This is implemented by the loader and persisted as
`is_assigned = 1` on exactly one row per ZCTA; the other intersection rows
remain in the table with `is_assigned = 0` so the full crosswalk fact is
auditable. 14 of the 262 unique NPPES practice ZIPs do not appear as any MS
ZCTA (13 are PO-box-only ZIPs not enumerated as ZCTAs; 1 is an Alabama
border ZIP; 1 a likely Florida typo) — these are excluded from county
provider counts and logged in `docs/data_cleaning_report.md`.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `zcta5` | TEXT | NO | 5-char ZCTA | — | `39208` | Census ZCTA file `GEOID_ZCTA5_20` | as-loaded; PK part 1 |
| `fips` | TEXT | NO | County FIPS this ZCTA touches | — | `28121` | Census ZCTA file `GEOID_COUNTY_20` | PK part 2; FK → counties |
| `county_name` | TEXT | NO | County name (denormalized convenience) | — | `Rankin County` | Census ZCTA file | as-loaded |
| `arealand_zcta` | INTEGER | YES | Total land area of the ZCTA | sq m | `93412331` | Census ZCTA file `AREALAND_ZCTA5_20` | as-loaded |
| `arealand_part` | INTEGER | YES | Land area of the intersection between this ZCTA and this county | sq m | `46202118` | Census ZCTA file `AREALAND_PART` | as-loaded |
| `is_assigned` | INTEGER | NO | Largest-pop assigned-county flag | 0 or 1 | `1` | derived | Exactly one row per `zcta5` has `is_assigned = 1`, chosen by largest `counties.population` among touched counties |

---

## 6. `health_indicators`

**Purpose.** Long-form ("tidy") PLACES facts. One row per
(county × measure × BRFSS year × value type). ~6,560 rows for MS:
82 counties × 40 measures × {2022 or 2023, one year per measure} × 2 value
types.

**Why we keep both `Crude prevalence` and `Age-adjusted prevalence`.** PLACES
publishes two prevalence variants for almost every measure. *Crude prevalence*
is the raw observed proportion of adults with the condition in that county;
*age-adjusted prevalence* recomputes the proportion to the year-2000 U.S.
standard population, stripping out the effect of differing age structures
between counties. Loading both preserves analytical optionality: a public
health practitioner studying *actual disease burden today* (e.g., for resource
allocation) wants the crude rate; a researcher comparing *underlying disease
patterns across counties* (e.g., for a structural-determinants analysis) wants
age-adjusted. Persisting both costs only ~3,300 extra rows and keeps both
audiences served by the same database without a re-load.

**Analytical convention: cross-county comparisons filter to age-adjusted.**
Mississippi counties have very different age structures — coastal retirement
counties skew older than the Delta — so unadjusted prevalences would conflate
real burden differences with demographic composition. Every Phase 3 query
that ranks or compares counties (q02 burden ranking, q05 EGI composite, q06
top-10 underserved, q08 driver analysis) filters `WHERE data_value_type =
'Age-adjusted prevalence'`. This is the standard PLACES analytical convention
and the same one CDC uses in its own ranking products. Crude prevalences are
retained so they can be surfaced verbatim alongside the adjusted figures in
any drill-down that calls for the raw burden number.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `fips` | TEXT | NO | County FIPS | — | `28049` | PLACES `LocationID` | as-loaded; PK part 1; FK → counties |
| `measure_id` | TEXT | NO | PLACES measure code | — | `DIABETES` | PLACES `MeasureId` | PK part 2; FK → measures |
| `year` | INTEGER | NO | BRFSS reference year | year | `2023` | PLACES `Year` | PK part 3; CHECK 2018–2030 |
| `data_value_type` | TEXT | NO | Crude vs age-adjusted | — | `Age-adjusted prevalence` | PLACES `Data_Value_Type` | PK part 4; CHECK enumerated |
| `data_value` | REAL | YES | Prevalence value | % | `15.3` | PLACES `Data_Value` | NULL if PLACES suppressed |
| `low_ci` | REAL | YES | Lower 95% confidence bound | % | `13.2` | PLACES `Low_Confidence_Limit` | as-loaded |
| `high_ci` | REAL | YES | Upper 95% confidence bound | % | `17.6` | PLACES `High_Confidence_Limit` | as-loaded |
| `total_population` | INTEGER | YES | PLACES denominator for this row | persons | `214870` | PLACES `TotalPopulation` | as-loaded |

---

## 7. `social_vulnerability`

**Purpose.** SVI 2022 facts, one wide row per MS county. Holds the 5
percentile rankings (overall + 4 themes) plus ~15 indicator estimates we use
directly in analysis.

**Intra-state percentiles and the -999 → NULL coercion.** Because we
downloaded the per-state SVI file (D-007), every `RPL_*` value is an
**intra-state percentile**: a county's overall rank of `0.80` means it is
more vulnerable than 80 % of *other Mississippi counties*, not 80 % of all
U.S. counties. This is exactly what a Mississippi-county equity index needs —
ranks within the state are the right reference frame for prioritizing
state-level decisions. Separately, the CDC/ATSDR SVI uses the numeric
sentinel `-999` to indicate "data not available" for both percentile and
percentage columns. Per D-014, the loader coerces every `-999` in the SVI
input to SQL `NULL` before insert. The schema's CHECK constraints on
percentile columns (`BETWEEN 0 AND 1`) and percentage columns
(`BETWEEN 0 AND 100`) act as a tripwire: any `-999` that slips through
coercion will hard-fail the INSERT, surfacing the bug immediately rather than
silently writing nonsense data into analysis.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `fips` | TEXT | NO | County FIPS | — | `28001` | SVI `STCNTY` | PK; FK → counties |
| `svi_year` | INTEGER | NO | SVI release year | year | `2022` | constant | CHECK 2018–2030 |
| `rpl_themes` | REAL | YES | Overall SVI percentile (intra-state) | 0–1 | `0.8025` | SVI `RPL_THEMES` | -999 → NULL; CHECK 0–1 |
| `rpl_theme1_socioeconomic` | REAL | YES | Theme 1 percentile (Socioeconomic Status) | 0–1 | `0.7037` | SVI `RPL_THEME1` | -999 → NULL; CHECK 0–1 |
| `rpl_theme2_household` | REAL | YES | Theme 2 percentile (Household Characteristics) | 0–1 | `0.8272` | SVI `RPL_THEME2` | -999 → NULL; CHECK 0–1 |
| `rpl_theme3_minority` | REAL | YES | Theme 3 percentile (Racial & Ethnic Minority Status) | 0–1 | `0.7654` | SVI `RPL_THEME3` | -999 → NULL; CHECK 0–1 |
| `rpl_theme4_housing_transport` | REAL | YES | Theme 4 percentile (Housing Type & Transportation) | 0–1 | `0.6543` | SVI `RPL_THEME4` | -999 → NULL; CHECK 0–1 |
| `e_totpop` | INTEGER | YES | SVI's total population estimate | persons | `29425` | SVI `E_TOTPOP` | for sanity vs ACS |
| `ep_pov150` | REAL | YES | % persons below 150 % poverty | % | `41.5` | SVI `EP_POV150` | -999 → NULL; CHECK 0–100 |
| `ep_unemp` | REAL | YES | % civilian unemployed | % | `7.1` | SVI `EP_UNEMP` | -999 → NULL; CHECK 0–100 |
| `ep_uninsur` | REAL | YES | % uninsured | % | `12.7` | SVI `EP_UNINSUR` | -999 → NULL; CHECK 0–100 |
| `ep_age65` | REAL | YES | % aged 65+ | % | `20.3` | SVI `EP_AGE65` | -999 → NULL; CHECK 0–100 |
| `ep_age17` | REAL | YES | % aged under 18 | % | `23.1` | SVI `EP_AGE17` | -999 → NULL; CHECK 0–100 |
| `ep_disabl` | REAL | YES | % with a disability | % | `17.4` | SVI `EP_DISABL` | -999 → NULL; CHECK 0–100 |
| `ep_sngpnt` | REAL | YES | % single-parent households | % | `12.0` | SVI `EP_SNGPNT` | -999 → NULL; CHECK 0–100 |
| `ep_limeng` | REAL | YES | % limited-English-speaking households | % | `1.1` | SVI `EP_LIMENG` | -999 → NULL; CHECK 0–100 |
| `ep_minrty` | REAL | YES | % racial/ethnic minority | % | `63.2` | SVI `EP_MINRTY` | -999 → NULL; CHECK 0–100 |
| `ep_mobile` | REAL | YES | % mobile homes | % | `14.6` | SVI `EP_MOBILE` | -999 → NULL; CHECK 0–100 |
| `ep_crowd` | REAL | YES | % crowded housing units | % | `1.5` | SVI `EP_CROWD` | -999 → NULL; CHECK 0–100 |
| `ep_noveh` | REAL | YES | % households with no vehicle | % | `8.4` | SVI `EP_NOVEH` | -999 → NULL; CHECK 0–100 |
| `ep_groupq` | REAL | YES | % in group quarters | % | `1.9` | SVI `EP_GROUPQ` | -999 → NULL; CHECK 0–100 |

---

## 8. `providers`

**Purpose.** One row per NPI for full traceability. Lets us answer "how many
Family Medicine NPs are in Sunflower County?" or "show me every provider
whose practice ZIP could not be resolved." Aggregations live in
`provider_capacity`; this table is the row-level source of truth.

**`fips` may be NULL.** 14 NPPES practice ZIPs (out of 262 unique MS
practice ZIPs) do not resolve to any MS ZCTA per D-010. Their providers are
loaded with `fips = NULL` so the audit trail is preserved; county
aggregations naturally exclude them.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `npi` | TEXT | NO | 10-digit National Provider Identifier | — | `1548263627` | NPPES `NPI` | PK; CHECK length=10 |
| `entity_type_code` | TEXT | YES | 1 = individual, 2 = organization | — | `1` | NPPES `Entity Type Code` | CHECK in ('1','2') OR NULL |
| `last_name` | TEXT | YES | Provider legal last name (individuals) | — | `RYAN` | NPPES `Provider Last Name (Legal Name)` | as-loaded |
| `first_name` | TEXT | YES | Provider first name (individuals) | — | `PATRICK` | NPPES `Provider First Name` | as-loaded |
| `practice_city` | TEXT | YES | Practice city | — | `OLIVE BRANCH` | NPPES practice city | as-loaded |
| `practice_state` | TEXT | NO | Practice state | — | `MS` | NPPES practice state | always `MS` (filtered) |
| `practice_zip5` | TEXT | NO | First 5 chars of practice ZIP | — | `38654` | NPPES practice ZIP | sliced from ZIP+4; CHECK length=5 |
| `practice_zip_full` | TEXT | YES | Original 5- or 9-digit ZIP | — | `386541941` | NPPES practice ZIP | as-loaded |
| `fips` | TEXT | YES | Assigned county FIPS | — | `28033` | derived via crosswalk | largest-pop assigned (D-010); NULL for 14 unmatched ZIPs |
| `taxonomy_code` | TEXT | NO | Provider's primary-care taxonomy | — | `207V00000X` | NPPES taxonomy | matched code (D-008); FK → taxonomies |
| `enumeration_date` | TEXT | YES | NPPES enumeration date | YYYY-MM-DD | `2008-04-22` | NPPES `Provider Enumeration Date` | as-loaded |
| `is_active` | INTEGER | NO | Active flag | 0 or 1 | `1` | derived | `1` for all loaded rows (deactivated dropped at load) |

---

## 9. `provider_capacity`

**Purpose.** Pre-aggregated provider counts per `(county, taxonomy)`. We
INSERT a row for every `(fips, taxonomy_code)` pair, **including zero-count
combinations**, so Phase 3 `GROUP BY fips` queries cannot accidentally miss a
county that has zero providers of a given taxonomy.

| Column | Type | Null? | Description | Units | Example | Source dataset | Transformation |
|---|---|---|---|---|---|---|---|
| `fips` | TEXT | NO | County FIPS | — | `28049` | derived | PK part 1; FK → counties |
| `taxonomy_code` | TEXT | NO | Provider taxonomy code | — | `207Q00000X` | derived | PK part 2; FK → taxonomies |
| `provider_count` | INTEGER | NO | Number of active providers of this taxonomy practicing in this county | providers | `74` | aggregated from `providers` | `COUNT(*)` grouped; zero-rows seeded |

**Two canonical query patterns over this table (computed at query time, not stored):**

```sql
-- Total primary-care providers per county (top 5)
SELECT c.county_name, SUM(pc.provider_count) AS total_primary_care
FROM counties c
LEFT JOIN provider_capacity pc ON pc.fips = c.fips
GROUP BY c.fips, c.county_name
ORDER BY total_primary_care DESC
LIMIT 5;
```

```sql
-- Primary-care providers per 10,000 residents, per county
SELECT
    c.fips,
    c.county_name,
    1.0 * SUM(pc.provider_count) * 10000.0 / c.population AS pcp_per_10k
FROM provider_capacity pc
JOIN counties c USING (fips)
GROUP BY c.fips, c.county_name, c.population
ORDER BY pcp_per_10k DESC;
```

`pcp_per_10k` is the primary-care-providers-per-10,000-population density used
throughout Phase 3 and Phase 3.5. It is intentionally **not** persisted, so
that the formula remains visible in SQL and stays in lockstep with whatever
populations and provider counts are in the database.

---

## Appendix: where to look for more

| For… | Look at… |
|---|---|
| Why we chose each dataset and vintage | `DECISIONS.md` D-001..D-010 |
| The 10-measure burden composite rationale | `DECISIONS.md` D-011 |
| Region partition citations | `DECISIONS.md` D-013 |
| -999 coercion rule | `DECISIONS.md` D-014 |
| Why no `regions` lookup table | `DECISIONS.md` D-015 |
| EGI weighting + view + component exposure + no-floor decisions | `DECISIONS.md` D-016..D-019 |
| Step-by-step cleaning narrative | `docs/data_cleaning_report.md` |
| Schema as runnable SQL | `schema/create_tables.sql` |
| ER diagram | `schema/er_diagram.png` |
