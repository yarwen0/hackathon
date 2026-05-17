# Decisions Log

Every judgment call made during this project, with rationale. Every choice is
defensible during the Monday presentation Q&A.

## How to read this document

Entries are numbered **D-001 through D-019** and grouped by project phase.
Each entry has the same shape:

- **Decision** — one sentence that captures what was chosen
- **Rationale** — why; usually with options considered and why they were rejected
- **Trade-off accepted** — what we knowingly gave up
- Often: **Implementation note**, **Validation results**, or an **Amendment** sub-block

When a decision is amended after first commit (only happened once — D-010), an
`AMENDMENT` sub-block records the change with date, reason, validation, and the
diff in human terms. The original decision text is preserved above the amendment.

## Table of contents

### Phase 0 — Setup
- [D-001](#d-001-python-312-homebrew-over-system-python-314) — Python 3.12 over system Python 3.14
- [D-002](#d-002-provider-data-source-cms-nppes--census-acs-not-hrsa-ahrf) — Provider source: CMS NPPES + Census ACS (not HRSA AHRF)
- [D-003](#d-003-data-vintages-locked) — Data vintages locked
- [D-004](#d-004-sqlite-over-postgres--duckdb) — SQLite over Postgres/DuckDB

### Phase 1 — Data Acquisition
- [D-005](#d-005-raw-data-lifecycle-gitignored-pipeline-downloaded-ms-filtered-subset-bundled-in-zip) — Raw data lifecycle
- [D-006](#d-006-cdc-places--2025-release-long-form-county-dataset) — CDC PLACES 2025 long-form
- [D-007](#d-007-cdcatsdr-svi--2022-release-mississippi-county-csv-direct) — CDC/ATSDR SVI 2022 MS county direct
- [D-008](#d-008-cms-nppes--may-2026-monthly-snapshot-ms--primary-care-taxonomies) — CMS NPPES + 6 primary-care taxonomies
- [D-009](#d-009-census-acs-2022-5-year--api-key-via-env-b01003_001e) — Census ACS via API key in .env
- [D-010](#d-010-zip--county-crosswalk-census-2020-zcta-county-relationship-file) — ZIP→county crosswalk (amended Phase 3 to largest-AREALAND_PART)

### Phase 2 — Schema Design & Ingestion
- [D-011](#d-011-places-burden-composite-scope-10-of-40-measures) — PLACES burden composite scope (10 of 40)
- [D-012](#d-012-phase-2-scope-schema--ingestion--quality-checks--cleaning-report) — Phase 2 scope
- [D-013](#d-013-region-partition-4-regions-with-cited-source-authorities) — 4-region partition with citations
- [D-014](#d-014-svi--999-missing-value-sentinel-coerced-to-null-at-load) — SVI -999 → NULL coercion + tripwire
- [D-015](#d-015-no-regions-lookup-table-region-citations-live-in-docs) — No `regions` lookup table

### Phase 3 — Analytical SQL
- [D-016](#d-016-egi-weighting-equal-thirds-for-the-three-components) — EGI equal-thirds weighting
- [D-017](#d-017-egi-implementation-as-a-sql-view-not-a-persisted-table) — EGI as a VIEW, not a table
- [D-018](#d-018-v_equity_gap_index-exposes-all-3-component-scores) — View exposes all 3 component scores
- [D-019](#d-019-egi-applies-no-population-floor) — No population floor (Issaquena = federal-HPSA validation)

---

## Phase 0 — Setup

### D-001. Python 3.12 (Homebrew) over system Python 3.14

**Decision:** Build the project on Python 3.12.13 (`brew install python@3.12`),
not the macOS-default Python 3.14.3.

**Rationale:**
- Python 3.14 was released October 2025. As of May 2026, several scientific
  libraries we depend on (notably `statsmodels`, certain `scipy`/`numpy`
  combinations, and parts of the `geopandas` stack) do not yet have universally
  available prebuilt wheels for 3.14 on macOS arm64. Falling back to source
  builds would consume hours of our 48-hour budget and could fail without a
  Fortran toolchain.
- Python 3.12 is the current stable, widely-supported scientific-stack version.
  All required packages installed cleanly from prebuilt wheels in a single
  `pip install` pass with no compilation step.

**Trade-off accepted:** Slightly older language features (no 3.13/3.14 syntax
sugar). None of those features are needed for this project.

### D-002. Provider data source: CMS NPPES + Census ACS, not HRSA AHRF

**Decision:** Use CMS NPPES (provider counts) joined to Census ACS 5-year
population estimates to compute providers-per-10,000-population, instead of
using the HRSA Area Health Resources File (AHRF).

**Rationale:**
- AHRF is a ~150 MB Microsoft Access / SAS file with thousands of columns
  covering hundreds of indicators. The download requires HRSA registration in
  many years, and only a small slice of columns are relevant to this index.
- CMS NPPES is a public, monthly-refreshed download of every NPI-registered
  provider in the U.S., filterable to Mississippi by practice-location state.
  We can aggregate to county FIPS using the practice address. ACS 5-year
  estimates are a stable Census product with first-class county-level
  geographies.
- The CMS + ACS path is leaner, more reproducible (no registration), and the
  schema is easier to defend: one provider table, one population table, both
  joined to counties on FIPS.

**Trade-off accepted:** AHRF includes precomputed measures (e.g., HPSA scores,
medically underserved area flags) that we will not get out of the box. We
compensate by building those concepts directly into our composite Equity Gap
Index (the burden + capacity + vulnerability blend is itself the underservedness
signal). If a curated AHRF subset turns up that is both small and direct-download,
we will reconsider before Phase 1 ends.

**Phase 1 revision (PLACES 2025 supersedes 2024):** When we attempted to pin
the PLACES 2024 release for download, the CDC data portal had already replaced
that file at the same Socrata dataset ID (`swc5-untb`) with the **2025 release**.
The 2025 release still uses **2022 BRFSS data** for most measures, so the
analytical reference year is unchanged. We switched to PLACES 2025 because
it is the current authoritative live file; using the archived 2024 from
Zenodo would have introduced a "why are you using last year's snapshot"
question we cannot defend. Year-mismatch tolerance is unaffected.

### D-003. Data vintages locked

**Decision:** The following dataset releases will be used and no others:

| Dataset      | Release / vintage              | Reference year(s) covered |
|--------------|--------------------------------|---------------------------|
| CDC PLACES   | 2025 release (revised — see note) | 2022 BRFSS estimates      |
| CDC SVI      | 2022 release                   | 2018–2022 ACS inputs      |
| CMS NPPES    | Most recent monthly snapshot   | Current providers         |
| Census ACS   | 2022 5-year estimates          | 2018–2022                 |

**Rationale:**
- Three of the four sources are anchored to the 2018–2022 ACS window, which
  gives the analysis a coherent ~2020–2022 reference period despite being
  released across different years.
- CMS NPPES is a live registry, so we use the freshest snapshot available; we
  document the snapshot date so the analysis is reproducible.
- Year-mismatch tolerance: differences of up to ~2 years between source
  vintages are acceptable for a structural underservedness index. Health
  burden, social vulnerability, and provider counts do not change rapidly at
  the county level on a 1–2 year scale. We document the vintage of every input
  in `schema/data_dictionary.md` and in the final README so reviewers can
  judge for themselves.

### D-004. SQLite over Postgres / DuckDB

**Decision:** The project database is SQLite (single `database.db` file shipped
inside the submission ZIP).

**Rationale:**
- The submission must be a single ZIP a judge can unzip and run. SQLite needs
  zero installation, zero server, zero credentials — Python's standard library
  ships `sqlite3`. Postgres would require the judge to install and run a
  server before being able to inspect the database.
- All required SQL features (CTEs, window functions, `PERCENT_RANK`, `NTILE`,
  `RANK`, joins, subqueries) are supported in SQLite 3.25+. The local system
  has SQLite 3.51, comfortably above that floor.
- The data volume is tiny: 82 Mississippi counties × a few dozen indicators
  fits comfortably in a few hundred KB. There is no performance argument for a
  heavier engine.

**Trade-off accepted:** SQLite has no native server-side stored procedures and
weaker type enforcement than Postgres. Neither matters here — all logic lives
in `.sql` files and Python scripts, not in stored procs.

---

## Phase 1 — Data Acquisition

### D-005. Raw data lifecycle: gitignored, pipeline-downloaded, MS-filtered subset bundled in ZIP

**Decision:** Raw data files live in `data/raw/` but are **excluded from git**
(.gitignore covers `data/raw/*.csv|zip|xlsx|json|gz|shp|geojson`). The
authoritative path from a clean checkout is `run_pipeline.py`, which downloads
each source from its pinned URL and writes a **Mississippi-filtered subset**
to `data/raw/`. The submission ZIP **does** bundle these MS-filtered subsets
as a snapshot, so a judge who cannot or will not re-download from CDC/CMS/
Census can still reproduce the analysis offline.

For three of the four datasets (PLACES, SVI, Census ACS) the filtered subset
is small enough (<1 MB each) to bundle without issue. For **CMS NPPES**, the
national source ZIP is 1.13 GB — far over the 25 MB submission cap — so we
download the national file, filter to MS providers + primary-care taxonomies
(see D-008), keep only the filtered MS subset on disk, and **delete the
national file after filtering**. The deletion is logged by the pipeline.

**Rationale:**
- Belt-and-suspenders: judges can either re-run the pipeline (full
  reproducibility, fresh data) or use the bundled snapshot (offline, exact
  inputs we ran against).
- Keeps the repo small and avoids checking large binary CSVs into git.
- Documents intent: `data/raw/` is canonical input, not derived output.

**Trade-off accepted:** The bundled MS-filtered NPPES is not strictly "raw" —
it has been filtered to MS practice state and primary-care taxonomy codes. We
document this in the data dictionary and in this file (see D-008) so reviewers
know exactly which slice was retained.

### D-006. CDC PLACES — 2025 release, long-form county dataset

**URL:** `https://data.cdc.gov/api/views/swc5-untb/rows.csv?accessType=DOWNLOAD`

**Format:** Long-form ("tidy") county dataset — one row per
(county FIPS × measure × data year). 22 columns. The county FIPS column is
**`LocationID`** (5-character string with leading zeros preserved when needed;
MS counties are `28001`..`28163`). Other key columns: `StateAbbr`,
`StateDesc`, `LocationName`, `Category`, `Measure`, `MeasureId`,
`Data_Value`, `Data_Value_Type`, `Low_Confidence_Limit`,
`High_Confidence_Limit`, `TotalPopulation`, `TotalPop18plus`, `Year`,
`Geolocation`.

**Why long-form (not GIS-friendly `i46a-9kgh`):**
- Cleaner dimensional modeling: a single `health_indicators` fact table keyed
  on `(fips, measure_id, year)` is the textbook tidy-data shape and is what
  the rubric's "Data Understanding & Schema Design" category rewards.
- We can demonstrate richer SQL: conditional aggregation, pivots via `CASE
  WHEN`, window functions across measures within a county.
- New measures can be added or dropped without altering the schema — the
  measure set is data, not structure.

**Filtering plan:** Download full national CSV (~hundreds of MB), filter to
`StateAbbr = 'MS'` in Python, write
`data/raw/places_county_ms_2025.csv`. Discard the national file.

**Retrieval date:** 2026-05-16 (about to execute)

**Notes:**
- The dataset ID `swc5-untb` is the **same** as the prior 2024 release —
  CDC reused the ID when the 2025 release dropped on 2024-12-23. The
  `Content-Disposition` header confirms `..._2025_release.csv` is served now.
- The MS subset contains **two BRFSS reference years simultaneously**:
  2023 BRFSS for the majority of measures and 2022 BRFSS for four
  blood-pressure / cholesterol / cholesterol-screening measures (the same
  four flagged by CDC in the release notes). Phase 3 SQL will select the
  most recent `Year` per `MeasureId` when computing the burden index, so
  the year-mix is handled cleanly.
- Filtered MS file: **6,560 rows × 22 columns**, covering **82 unique
  counties × 40 measures × {1–2 years}**. File size: 1.55 MB.
- Retrieval timestamp: 2026-05-16 ~21:53 local.

### D-007. CDC/ATSDR SVI — 2022 release, Mississippi county CSV (direct)

**URL:** `https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/Mississippi_COUNTY.csv`

**Format:** CSV. ~82 rows (one per MS county). Columns include FIPS (5-digit
string with leading zero on "01"-prefix counties, though MS = 28 has no
leading zero issue), state/county names, plus four theme summary rankings
(`RPL_THEME1`..`RPL_THEME4`), the overall summary ranking (`RPL_THEMES`),
and individual indicator values for each variable used in the index.

**Size:** 61,790 bytes (~62 KB) — small enough to bundle directly.

**Filtering plan:** Download MS-county file directly (no national-then-filter
needed since CDC publishes a per-state file already). Save as
`data/raw/svi_county_ms_2022.csv` unchanged.

**Retrieval date:** 2026-05-16 (about to execute)

**Notes:**
- The `states_counties/<State>_COUNTY.csv` path pattern was verified by
  HEAD-probing the candidate URLs; status 200 confirmed.
- SVI rankings in a per-state file are computed against that state's
  counties only (intra-state percentile ranks), which is exactly what we
  want for a Mississippi-county equity index.
- File contains **82 rows × 158 columns** covering all MS counties.
- The file has two FIPS-shaped columns, `STCNTY` and `FIPS`, which are
  pairwise identical across all 82 rows (verified). We use `STCNTY` in
  the canonical schema; `FIPS` is treated as a redundant alias.
- Retrieval timestamp: 2026-05-16 ~21:53 local.

### D-008. CMS NPPES — May 2026 monthly snapshot, MS + primary-care taxonomies

**URL:** `https://download.cms.gov/nppes/NPPES_Data_Dissemination_May_2026_V2.zip`

**Size (national ZIP):** 1,131,435,518 bytes (~1.13 GB)

**Format:** ZIP containing a national CSV (`npidata_pfile_*.csv`) of all
NPI-registered providers in the U.S. The CSV has ~330+ columns — most are
the 15 taxonomy/license/address slots per provider — and millions of rows.

**Filtering plan:**
1. Download the national ZIP to a temp path.
2. Extract just `npidata_pfile_*.csv` (skip the deactivated-NPI file, the
   readme, and the other-name file — they are not needed for capacity
   counts).
3. Stream the CSV (chunked read in pandas) and keep only rows where:
   - `Provider Business Practice Location Address State Name` is `MS`, AND
   - **any** of the 15 `Healthcare Provider Taxonomy Code_n` columns
     matches one of the **six primary-care taxonomy codes** below (per
     HRSA's primary-care HPSA definition).
4. Project to a minimal column set (NPI, entity type, provider name,
   practice city, practice state, practice zip, practice county/FIPS,
   matched taxonomy code).
5. Write `data/raw/cms_nppes_ms_primary_care_2026-05.csv`.
6. **Delete the full national ZIP and extracted CSV** to reclaim disk
   space; log the deletion path and byte count in DECISIONS.md (see
   D-008.x deletion log to be appended after execution).

**Taxonomy filter (primary care, HRSA-aligned):**

| Code         | Description              |
|--------------|--------------------------|
| 207Q00000X   | Family Medicine          |
| 207R00000X   | Internal Medicine        |
| 208000000X   | Pediatrics               |
| 207V00000X   | Obstetrics & Gynecology  |
| 363L00000X   | Nurse Practitioner       |
| 363A00000X   | Physician Assistant      |

**Columns of interest retained in the MS subset:**
- `NPI`
- `Entity Type Code` (1 = individual, 2 = organization)
- `Provider Last Name (Legal Name)` / `Provider First Name`
- `Provider Business Practice Location Address City Name`
- `Provider Business Practice Location Address State Name`
- `Provider Business Practice Location Address Postal Code` (5-digit ZIP
  for county FIPS lookup via HUD ZIP→County crosswalk or Census ZCTA)
- `Healthcare Provider Taxonomy Code_1..15` (collapsed to a single matched
  taxonomy column in the filtered output for simplicity)
- `Provider Enumeration Date`
- `NPI Deactivation Date` (drop deactivated NPIs)

**Why these six taxonomies:** They match HRSA's definition of primary-care
providers for Health Professional Shortage Area (HPSA) designation. Using
the HRSA-aligned set keeps our "provider capacity" denominator comparable to
the federal underservedness metrics referenced in the contextual research
write-up (Phase 5 `docs/context_and_background.md`).

**Rationale for MS-only retention:**
- National NPPES is ~1.13 GB compressed, ~10 GB uncompressed. Bundling
  national in the submission ZIP is impossible (>>25 MB).
- The filtered MS primary-care subset is expected to be <5 MB.
- `run_pipeline.py` re-downloads the national file from CMS on demand for
  full reproducibility; the bundled subset gives offline reviewers the exact
  rows we used.

**FIPS derivation note:** NPPES does **not** ship a FIPS column directly; we
derive county FIPS from the practice ZIP using a ZIP-to-county crosswalk.
We will pick the crosswalk source (HUD USPS quarterly file vs Census ZCTA)
in Phase 2 and document it in a follow-up decision record.

**Filter execution results (2026-05-16 ~21:55 local):**
- National file streamed: 9,551,447 rows (chunked, ~200k at a time)
- MS practice rows observed: 56,806
- Active MS + primary-care subset retained: **6,404 providers**
- Breakdown by taxonomy: Family Medicine 1,981 / Nurse Practitioner 1,481 /
  Internal Medicine 1,447 / Pediatrics 640 / Obstetrics & Gynecology 455 /
  Physician Assistant 400
- 262 unique 5-digit practice ZIPs across the 6,404 retained rows
- Filtered file: 555 KB
- Deletion log: 1.13 GB ZIP + 11.4 GB extracted CSV under
  `data/raw/_tmp_nppes/` removed; ~12 GB disk reclaimed
- Stream filter ran in 27 seconds wall time

**Retrieval date:** 2026-05-16 (executed)

### D-009. Census ACS 2022 5-year — API key via .env, B01003_001E

**API endpoint:**
`https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E&for=county:*&in=state:28&key=$CENSUS_API_KEY`

**Variable:** `B01003_001E` — total population estimate, 5-year period
2018–2022.

**Geography:** All counties (`for=county:*&in=state:28`) → 82 MS counties.

**Response format:** JSON array; first row is the column header. We parse
into a 4-column DataFrame (`NAME`, `population`, `state`, `county`),
synthesize `fips = state || county` as a 5-digit zero-padded string, and
save to `data/raw/census_acs_county_population_ms_2022.csv`.

**Expected response size:** ~6 KB.

**Authentication:**
- Census API requires a key for any request (we confirmed by probing
  without a key — server returns HTTP 302 → "Missing Key" page).
- Key stored in `.env` at the project root as `CENSUS_API_KEY=...`.
- `.env` is in `.gitignore`. `.env.example` is committed with a placeholder
  so future operators know which variables to set.
- Python loads the key via `python-dotenv`. The key never enters source
  code or git history.

**Rationale for API over data.census.gov bulk download:**
- Reproducibility: `run_pipeline.py` regenerates the file end-to-end.
- Smallest possible payload (a single-table query with one variable for one
  state).
- Standard practice for working with Census; the API key signup is free
  and unmoderated.

**Retrieval date:** to be filled in when the key is provided and the call
runs.

**Execution results (2026-05-16):**
- HTTP 200 once the user-supplied key was activated by clicking the
  Census email link.
- 82 MS counties returned, all FIPS `28xxx`, 5-char strings synthesized
  from `state || county`.
- Population range: 1,206 (Issaquena) → 226,541 (Hinds). State total:
  2,958,846 — matches the published Census 2018–2022 5-year MS estimate.
- File: `data/raw/census_acs_county_population_ms_2022.csv` — 4,051 bytes.

### D-010. ZIP → County crosswalk: Census 2020 ZCTA-County relationship file

**Decision:** Use the Census 2020 ZCTA-to-County Relationship File (Option B
proposed in Phase 1) instead of the HUD USPS ZIP_COUNTY crosswalk
(Option A originally requested) to attribute NPPES providers to counties.

**URL:** `https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt`

**Format:** Pipe-delimited (`|`), UTF-8 with BOM, ~6.8 MB national, 47,863
rows / 18 columns. After filtering to MS (county FIPS `28xxx`) and dropping
rows without a ZCTA, the working subset is **771 ZCTA-county intersection
rows covering 428 unique ZCTAs across all 82 MS counties**, saved to
`data/raw/census_zcta_county_crosswalk_ms_2020.csv` (54.6 KB).

**Vintage:** 2020 decennial Census geographies. ZCTA boundaries are
revised only at the decennial; the 2020 file is the current authoritative
version through the 2030 cycle.

**Rationale for Option B (Census ZCTA) over Option A (HUD USPS):**
- HUD's crosswalk requires an account, email confirmation, and login to
  download. Adds friction without proportional gain for our purposes.
- Census ZCTA relationship file is a direct download, no login, pure
  Census provenance — consistent with D-009 (also Census).
- For *provider point counts*, ZIP→county allocation method is structurally
  less sensitive than dollar-allocations would be: most MS provider ZIPs
  map predominantly to a single county, and the "wrong" county for a
  multi-county ZIP usually shares the same regional health context anyway.

**Multi-county ZCTA assignment rule:** When a single ZCTA spans multiple
counties (54% of MS ZCTAs do, 230 of 428), the provider count for that
ZCTA is attributed to the **county with the largest population** among the
counties the ZCTA touches, where population comes from
`census_acs_county_population_ms_2022.csv` (D-009). Reasoning: NPPES practice
addresses are point locations; the population-largest county is the
highest-probability actual physical-location county for any provider whose
practice ZIP intersects multiple counties. This rule is implemented in
Phase 2 ingestion (the crosswalk file itself stores the raw multi-row
intersection facts so the rule is auditable).

**NPPES coverage check:** 248 of 262 unique NPPES practice ZIPs (94.7%)
match a MS ZCTA in the crosswalk — above our 90% acceptability threshold.

**Unmatched ZIPs (14 total):**
- 13 are USPS-only ZIPs without a corresponding Census ZCTA (almost all
  PO-box-only ZIPs in Jackson, Meridian, Hattiesburg metros, e.g., `39225`,
  `39302`, `39404`, `39407`, `39441`, `39555`, `39703`, `39710`, `39760`).
  We accept these as unattributable and exclude them from the county
  provider count, documented in the data cleaning report.
- 1 is `36345`, an Alabama ZCTA (Dale/Henry/Houston counties, AL) — a
  border ZIP that NPPES has flagged as a MS-state practice address.
  Likely a provider whose mailing convention crosses the state line; we
  treat this as a data-entry anomaly and exclude.
- 1 (`33804`) is a Lakeland, FL ZIP — likely a typo by the provider.
  Excluded.

**Retrieval date:** 2026-05-16 ~21:58 local.

#### D-010 AMENDMENT (Phase 3, 2026-05-16 ~23:21 local)

**Rule change.** The largest-population assignment rule above is REPLACED
by a **largest-AREALAND_PART** rule: each ZCTA is assigned to the county
where its **physical land area overlap is greatest**, not the county
whose total population is greatest.

**Why it changed.** Reviewing q03 output revealed 16 of 82 counties (20%)
with **zero attributed primary-care providers** — implausibly high. Root
cause traced to Clay County (pop 18,598): its county-seat ZIP 39773
(West Point) was being assigned to Monroe County purely because Monroe
(pop 34,168) had more residents, even though 95% of ZIP 39773's land area
sits inside Clay County. The original rule systematically under-attributed
providers in smaller counties whose ZCTAs were shared with larger
neighbors. AREALAND_PART is the more direct geographic measure of where a
ZCTA actually sits.

**Validation after reload.**
- Counties with zero attributed providers: **16 → 1** (only Issaquena, pop
  1,206 — a chronic federally-designated HPSA; the zero is plausibly real).
- q03 ties at capacity_gap_score=100: **5 → 1**.
- Clay County total providers: **0 → 128**; retains ZIP 39773 (West Point)
  with 32 providers.
- Starkville ZIP 39759 correctly still assigned to Oktibbeha (Starkville
  IS in Oktibbeha; 99.9% of that ZIP's land area is there).
- Sum of provider_capacity unchanged (6,377) — same providers,
  redistributed.
- All 27 DQ checks still PASS.
- New top-5 worst-capacity list (Issaquena, Carroll, Greene, Benton,
  Copiah) all match plausibly underserved rural MS counties.
- New bottom-3 best-capacity list (Alcorn/Lee/Hinds) all match real MS
  healthcare hubs (Corinth / Tupelo NMMC / Jackson UMMC).

**Implementation.** A single 5-line change in `load_zcta_crosswalk()`:
replaced `df.groupby("zcta5")["population"].idxmax()` with
`df.groupby("zcta5")["arealand_part"].idxmax()` (with NaN→0 coercion).
The county-population fetch is removed — no longer needed.

**Trade-off accepted.** AREALAND_PART measures geographic overlap, not
which county actually has the post office or population center inside
the ZCTA's main settled area. For a few ZCTAs whose largest land area
sits in a sparsely-populated portion of a neighboring county, the
attribution could still be wrong. But the failure mode is now random
(geographically idiosyncratic) rather than systematic (always favoring
larger counties), which is preferable. The new rule is also the same
choice the HRSA AHRF would have made.



---

## Phase 2 — Schema Design & Ingestion

### D-011. PLACES burden composite scope: 10 of 40 measures

**Decision:** The PLACES burden composite (one of three inputs to the EGI) is
computed from exactly these **10 measures**, not all 40:

| Domain              | MeasureId   | Description                                | Polarity |
|---------------------|-------------|--------------------------------------------|----------|
| Chronic disease     | DIABETES    | Diagnosed diabetes                         | +1       |
| Chronic disease     | BPHIGH      | High blood pressure                        | +1       |
| Chronic disease     | OBESITY     | Obesity                                    | +1       |
| Chronic disease     | COPD        | Chronic obstructive pulmonary disease      | +1       |
| Chronic disease     | CHD         | Coronary heart disease                     | +1       |
| Mental health       | DEPRESSION  | Depression                                 | +1       |
| Mental health       | MHLTH       | Frequent mental distress (>=14 days/mo)    | +1       |
| Healthcare access   | ACCESS2     | Lack of health insurance (ages 18–64)      | +1       |
| Healthcare access   | CHECKUP     | Routine checkup in past year               | **−1**   |
| Prevention          | CHOLSCREEN  | Cholesterol screening                      | **−1**   |

**Rationale:**
- Balanced four-domain mix (chronic disease / mental health / access /
  prevention) so no single domain dominates the burden score.
- Each domain has well-documented public-health salience for Mississippi
  specifically (high diabetes & CHD burden; rural mental-health desert;
  highest-in-nation uninsured rate).
- Ten components is enough to give a stable composite (averaging 10
  measures is far less noisy than averaging 3) without overweighting any
  single signal.
- The other 30 measures remain queryable for ad-hoc analysis and judge
  Q&A — they load into the same tables, just with
  `is_in_burden_composite = 0`.

**Polarity semantics:** 8 of the 10 are "more is worse" (polarity = +1);
CHECKUP and CHOLSCREEN are preventive services where **higher = better**,
so their polarity is **−1** and the burden math inverts them. Polarity is
populated for **all 40 measures** at load time (Refinement 1 from user):
six measures get polarity = −1 (BPMED, CHECKUP, CHOLSCREEN, COLON_SCREEN,
DENTAL, MAMMOUSE — all preventive services / treatment-adherence), the
remaining 34 get +1. This is forward-compatible: if the composite is ever
extended, polarity is already there.

**Implementation:** All 40 PLACES measures load into `measures` and
`health_indicators`. The `is_in_burden_composite` column on `measures`
flags the 10 above with value 1; others get 0. Phase 3 q05 (EGI) filters
`WHERE m.is_in_burden_composite = 1` and uses `m.polarity` to orient the
math.

### D-012. Phase 2 scope: schema + ingestion + quality checks + cleaning report

**Decision:** Phase 2 produces everything needed to go from raw CSVs to a
fully populated, queryable `database.db`, plus the bonus-criteria data
cleaning deliverable. Specifically the following seven artifacts:

| # | Deliverable           | File                                          |
|---|-----------------------|-----------------------------------------------|
| 1 | Schema                | `schema/create_tables.sql`                    |
| 2 | ER diagram (textual)  | `schema/er_diagram.md` (mermaid)              |
| 3 | ER diagram (image)    | `schema/er_diagram.png`                       |
| 4 | Data dictionary       | `schema/data_dictionary.md`                   |
| 5 | Ingestion script      | `python/01_load_data.py`                      |
| 6 | Data quality checks   | `python/01b_data_quality_checks.py`           |
| 7 | Cleaning report       | `docs/data_cleaning_report.md`                |

The DQ-check script also emits `data/processed/data_quality_report.txt`
which the cleaning report cites.

**Rationale:** Bundling schema design, ingestion, and validation into a
single phase ensures the schema and the ingestion match. Splitting them
across phases risks the schema being designed in isolation from the
ingestion realities surfaced in Phase 1. The cleaning report assembles
material already in DECISIONS.md and QUESTIONS.md into a judge-facing
narrative — assembly, not authorship.

**Exit criteria:** All 7 artifacts produced; `database.db` loads cleanly
from `data/raw/*.csv` via `python python/01_load_data.py`; all data quality
checks pass via `python python/01b_data_quality_checks.py` (exit code 0);
PROJECT_PLAN.md Phase 2 boxes ticked; RUBRIC_CHECKLIST.md "Data
Understanding & Schema Design" and "Data cleaning workflows" items ticked.

### D-013. Region partition: 4 regions with cited source authorities

**Decision:** Each MS county is assigned to exactly one of four regions:

| Region    | Count | Counties                                                                                                                                                         |
|-----------|-------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Delta     | 18    | Bolivar, Carroll, Coahoma, DeSoto, Holmes, Humphreys, Issaquena, Leflore, Panola, Quitman, Sharkey, Sunflower, Tallahatchie, Tate, Tunica, Warren, Washington, Yazoo |
| Coastal   | 3     | Hancock, Harrison, Jackson                                                                                                                                       |
| Pine Belt | 8     | Forrest, Lamar, Marion, Pearl River, Perry, Stone, Walthall, Wayne                                                                                               |
| Other     | 53    | All remaining counties (capital region, hills, Black Prairie, etc.)                                                                                              |

**Source authorities:**
- **Delta** — Mississippi Delta Regional Authority (DRA), the federal
  regional commission whose authorizing legislation enumerates the 18 MS
  Delta counties. Authoritative URL: `msdelta.gov`.
- **Coastal** — Mississippi Gulf Coast counties as defined in MS Department
  of Health regional planning: Hancock, Harrison, Jackson (the three
  counties touching the Gulf of Mexico).
- **Pine Belt** — Pine Belt Mental Healthcare Resources service-area
  definition, the conventional 8-county Pine Belt. The same 8 counties are
  used by the Pine Belt Regional Solid Waste Management Authority and
  other regional entities.
- **Other** — Residual: not in any of the above three. Composed of the
  capital region (Hinds/Madison/Rankin), north-central hills, Black
  Prairie, and other sub-regions. We do not further subdivide because
  (a) the primary analytical contrast in Phase 3 q07 is **Delta vs
  non-Delta**, not finer partition, and (b) further subdivision would
  produce regions so small (n < 5 counties) that statistical comparisons
  would be meaningless.

**Borderline cases documented:**
- **DeSoto County** is included in Delta per the MDRA's official 18-county
  designation. Functionally, DeSoto is Memphis-suburban (population 186k,
  the third-largest MS county), which would make it an outlier within
  Delta health metrics. We retain DeSoto in Delta because (a) the official
  MDRA classification is the most citation-defensible choice, and
  (b) treating DeSoto specially would compound an arbitrary judgment.
  Phase 3 q07 will surface DeSoto's metrics alongside the rest of Delta;
  any unusual signature can be flagged in the analysis writeup.
- **Holmes, Panola, Carroll** are sometimes counted as hill country rather
  than Delta in informal usage. MDRA includes all three; we follow MDRA.

**Loading mechanism:** The 82-row region assignment is hard-coded in
`python/01_load_data.py` as a FIPS-keyed dictionary, sourced from MDRA
plus the cited regional authorities. The cleaning report cites the same
sources so the partition is defensible at the presentation.

### D-014. SVI -999 missing-value sentinel coerced to NULL at load

**Decision:** The CDC/ATSDR SVI 2022 source file uses the literal value
`-999` (numeric, not a string) as a sentinel for "data not available" in
both percentile (RPL_*, EPL_*) and percentage estimate (EP_*) columns.
The loader (`python/01_load_data.py`) **coerces every -999 in the SVI
input to SQL NULL** before insertion into `social_vulnerability`.

**Defense-in-depth:** The schema (`schema/create_tables.sql`) adds CHECK
constraints on every percentile column (`BETWEEN 0 AND 1` or NULL) and
every percentage column (`BETWEEN 0 AND 100` or NULL) on
`social_vulnerability`. If the loader ever fails to coerce a -999 — for
example, after a column is added to SVI but missed in the coercion
list — the database INSERT will hard-fail with a CHECK constraint
violation, surfacing the bug immediately rather than silently writing
nonsense data.

**Rationale:**
- -999 is a CDC convention but is poisonous to numeric SQL — it would
  bias averages, percentiles, and correlations if treated as a real value.
- NULL is the correct SQL representation of "unknown" and propagates
  through aggregates correctly (averages ignore it, COUNT(*) vs COUNT(col)
  behavior makes missingness visible).
- The CHECK constraints act as a tripwire: any silent regression in
  coercion logic is caught at load time, not in the analysis.

**Implementation:** Loader uses `df.replace(-999, pd.NA)` on the SVI
numeric columns immediately after read; the NaN values then become SQL
NULL when written via pandas-to-SQLite.

### D-015. No `regions` lookup table; region citations live in docs

**Decision:** The schema deliberately does NOT include a `regions`
reference table. Region values (`Delta`, `Coastal`, `Pine Belt`, `Other`)
live as a CHECK-constrained TEXT column on `counties`. Region definitions
and source authorities live in DECISIONS.md (D-013) and the data
dictionary, not in a database row.

**Rationale:**
- 4 region values total; a `regions` table would have 4 rows and one
  column we actually need (a textual label that's already self-describing).
- Phase 3's regional comparison query (q07) becomes `WHERE region = 'Delta'`
  rather than `JOIN regions ON counties.region_id = regions.id` — easier
  to teach, audit, and defend in the presentation.
- Citation queryability was the main argument *for* a `regions` table
  (e.g., a `regions.source_url` column). We rejected this because the
  citations belong in human-readable docs (DECISIONS.md, data dictionary,
  cleaning report), not in tabular database rows that judges won't query.
- A CHECK constraint enumerating the 4 valid values prevents typo errors
  at load time, which is what a normalized lookup table would otherwise
  guard against.

**Trade-off accepted:** If we ever needed region-level attributes
(description, color hint for visualizations, sub-region tier), we would
add a tiny `regions` reference table at that point. Adding the table
later is a no-op for existing queries because `counties.region` becomes
the FK column. Nothing is being lost by deferring.



---

## Phase 3 — Analytical SQL

### D-016. EGI weighting: equal thirds for the three components

**Decision:** The Equity Gap Index combines its three components (burden,
capacity, vulnerability) with **equal weights of 1/3 each**, summing to 1.0.
The weights are stored in a single `weights` CTE inside the
`v_equity_gap_index` view so a stakeholder who later wants different weights
changes one row.

**Options considered:**

| Weights | Source / framing | Why not chosen |
|---|---|---|
| **1/3, 1/3, 1/3** (chosen) | County Health Rankings convention; SVI's own equal-theme weighting | — |
| 0.4 burden / 0.3 capacity / 0.3 vulnerability | "Burden is the downstream outcome that matters most" | The EGI's purpose is to identify upstream gaps; privileging the downstream measure inverts the analytical intent |
| Empirical (PCA, factor loadings) | "Let the data choose" | Opaque defense ("the math chose them"); with n=82 and only 3 components, derived weights are unstable; weakens stakeholder confidence |
| HRSA HPSA-style | Federal precedent | HRSA weights are for single-county HPSA designation, not composite indices; specific weights vary by HPSA type |

**Defense for equal thirds:**
1. **Precedent.** County Health Rankings (RWJF / U. Wisconsin) — the leading
   U.S. county health composite — uses equal-weighted theme aggregation. SVI
   itself uses equal weights across its 4 themes (computed by CDC/ATSDR).
   Following these conventions is established practice.
2. **Honesty.** This is a 48-hour analysis without formal stakeholder
   elicitation. Any non-equal weights would require defending a choice we
   can't substantively defend.
3. **Transparency.** Equal weights are immediately interpretable. "Each
   pillar counts equally" is one sentence.
4. **Tunability.** Weights live in a single `weights` CTE — any future
   stakeholder who wants 0.5/0.3/0.2 makes a one-line edit.

**Presentation framing for Monday:** *"We use equal weights — the same
convention used by the County Health Rankings, the leading U.S. county
health composite. We considered three alternative weighting schemes, but in
a 48-hour analysis without formal stakeholder elicitation, equal weights
are the only fully defensible choice."*

### D-017. EGI implementation as a SQL VIEW, not a persisted table

**Decision:** `v_equity_gap_index` is a SQL VIEW
(`CREATE VIEW v_equity_gap_index AS WITH ... SELECT ...`), not a persisted
table populated by the loader. This confirms the earlier deferral noted in
D-006.

**Rationale:**
- At 82-row scale, view recomputation on read is sub-millisecond.
- The math stays auditable in `sql/q05_equity_gap_index.sql`. A judge can
  read q05 and see exactly how every EGI score is computed.
- The loader stays focused on raw data; analysis logic lives in `sql/`.
  Clean separation.
- Visualizations and Phase 3.5 statistics query the view as if it were a
  table (`SELECT * FROM v_equity_gap_index`). The interface is identical.
- If we ever need persistence, `VIEW` → `CREATE TABLE AS` is a 10-second
  swap.

**Trade-off accepted:** None of real consequence at our scale.

### D-018. v_equity_gap_index exposes all 3 component scores

**Decision:** The view's output includes the burden, capacity, and
vulnerability component scores alongside the final EGI score, rank, and
quintile — **10 columns total per row**.

**Columns:**

```
fips, county_name, region, population,
burden_component, capacity_component, vulnerability_component,
egi_score, egi_rank, egi_quintile
```

**Rationale:**
1. **q08 requirement.** The drivers-analysis query identifies which
   component dominates each top-10 county's underservedness. Without the
   components in the view, q08 would have to re-implement the EGI math.
2. **q06 / q07 use.** Top-10 ranking and regional patterns both benefit
   from one-row-per-county breakdowns.
3. **Judge verifiability.** Every row is independently verifiable:
   `0.333 × burden + 0.333 × capacity + 0.333 × vulnerability ≈ egi_score`.
   A judge can pick any row and check the arithmetic by hand.
4. **Downstream stats / viz.** Phase 3.5 correlation matrix and Phase 4
   scatter plots all want the components, not just the composite.

**Trade-off accepted:** 3 extra columns of width vs. requiring downstream
queries to re-derive the components. The width is trivial; the
re-derivation cost (cognitive load + drift risk) is real.

### D-019. EGI applies no population floor

**Decision:** The EGI ranks all 82 MS counties regardless of population.
The smallest counties — notably Issaquena (population 1,206) — remain in
the ranking if their composite metrics warrant a high score.

**Why this came up.** Issaquena will hit `capacity_component = 100` exactly
because it has zero attributed primary-care providers (verified post D-010
amendment as a true zero, not an artifact). With burden and vulnerability
also high, Issaquena is a candidate for #1 EGI driven partly by one
extreme component.

**Options considered:**

| Option | Treatment | Verdict |
|---|---|---|
| **A. No floor** (chosen) | Issaquena ranks where the math puts it | — |
| B. Population floor (e.g., exclude counties under 5,000) | Would exclude Issaquena, Sharkey, etc. | Rejected |
| C. Population-weighted component | sqrt(pop) or similar dampening | Rejected |

**Defense for A (no floor):**

1. **Federal cross-validation.** Issaquena IS a federally-designated Health
   Professional Shortage Area (HPSA). Our index identifying it as #1
   underserved is **independent confirmation that the methodology works** —
   not a methodological flaw. If our marquee index missed Issaquena it
   would be a problem.
2. **Population is already accounted for** in the per-capita capacity metric
   (`pcp_per_10k`). Adding a second population adjustment would
   double-count.
3. **Excluding small counties is the wrong message.** Small rural counties
   ARE underserved. Filtering them would understate the scope of the
   underservedness problem the EGI is supposed to surface.
4. **Frames the presentation well.** *"Our #1 EGI county coincides with a
   federal HPSA designation. We didn't engineer that — it's what the math
   produces."* That's independent validation, which is rare and valuable.

**Trade-off accepted:** Some counties may dominate the top of the ranking
primarily because of one extreme component. We surface this via D-018
(exposing all 3 components) so any judge or stakeholder can see whether a
top-ranked county is "stacked" across all 3 pillars or "single-component
driven." The information loss from a floor is worse than the information
loss from transparently showing single-component drivers.

---

## Phase 3.5 — Statistical Analysis

_(to be filled in)_

---

## Phase 4 — Visualizations

_(to be filled in)_

---

## Phase 5+ — Automation, Notebook, Docs, Presentation

_(to be filled in)_
