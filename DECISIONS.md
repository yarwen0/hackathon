# Decisions Log

Every judgment call made during this project, with rationale. The point is that
every choice should be defensible during the Monday presentation Q&A.

Updated in real time as decisions are made. Newest entries at the bottom of each
section.

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



---

## Phase 2 — Schema Design & Ingestion

_(to be filled in)_

---

## Phase 3 — Analytical SQL

_(to be filled in)_

---

## Phase 3.5 — Statistical Analysis

_(to be filled in)_

---

## Phase 4 — Visualizations

_(to be filled in)_

---

## Phase 5+ — Automation, Notebook, Docs, Presentation

_(to be filled in)_
