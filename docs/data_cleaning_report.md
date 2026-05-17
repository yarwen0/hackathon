# Data Cleaning Report — Mississippi Health Equity Gap Index

> Judge-facing narrative of every cleaning, filtering, normalization, and
> reconciliation step applied between the five raw source files and the
> populated `database.db`. Each step cites the decision record in
> `DECISIONS.md` and, where applicable, the open-question record in
> `QUESTIONS.md`. The validation results section is regenerated each load
> by `python/01b_data_quality_checks.py` and saved to
> `data/processed/data_quality_report.txt`.

## 1. Overview

Five raw, MS-filtered CSVs land in `data/raw/`. A single ingestion
script (`python/01_load_data.py`) reads them, applies the cleaning
rules below, and loads a fully-constrained SQLite database
(`database.db`). A separate quality-checks script
(`python/01b_data_quality_checks.py`) then verifies the loaded
database against a battery of structural and value-range assertions
and exits non-zero on any failure.

The five inputs:

| Source     | File                                         | Raw rows | Vintage           | Decision |
|------------|----------------------------------------------|---------:|-------------------|----------|
| PLACES     | `places_county_ms_2025.csv`                  | 6,560    | 2025 release (BRFSS 2022/23) | D-003, D-006 |
| SVI        | `svi_county_ms_2022.csv`                     | 82       | 2022              | D-007    |
| NPPES      | `cms_nppes_ms_primary_care_2026-05.csv`      | 6,404    | May 2026 monthly  | D-008    |
| ACS        | `census_acs_county_population_ms_2022.csv`   | 82       | 2018–2022 5-year  | D-009    |
| ZCTA xwalk | `census_zcta_county_crosswalk_ms_2020.csv`   | 771      | 2020 decennial    | D-010    |

The cleaning work below is **deterministic, auditable, and idempotent**:
the loader can be re-run from scratch against the same raw CSVs and will
produce a bit-identical database. Every cleaning rule is captured as code
(in `python/01_load_data.py`) and as a constraint (CHECK / FOREIGN KEY in
`schema/create_tables.sql`). Where the two disagree, the constraint wins
and the load fails loudly.

## 2. Per-dataset cleaning steps

### 2.1 CDC PLACES — 2025 release, long-form

| # | Step | Where it happens | Justification |
|---|---|---|---|
| 1 | National file streamed and filtered to `StateAbbr = 'MS'` | Phase 1 download (Sat 21:53) | The national PLACES CSV is 51 MB / 229,298 rows; we ship the 1.55 MB MS subset (D-006). |
| 2 | County FIPS taken from `LocationID` (5-char string) | Loader `pad_fips()` | The column is `LocationID`, NOT `CountyFIPS` (corrected during Phase 1 — see QUESTIONS.md "PLACES county FIPS column"). |
| 3 | Both `Crude prevalence` and `Age-adjusted prevalence` retained | Loader `load_health_indicators()` | Different consumers want different lenses; persisting both costs ~3,280 rows and serves both audiences. Cross-county comparison queries filter to age-adjusted. (See data dictionary, `health_indicators` section.) |
| 4 | Other `Data_Value_Type` variants dropped | Loader `load_health_indicators()` | The schema's CHECK constraint only allows the two prevalence types. Anything else (e.g. `Mean number of unhealthy days`) lies outside the analytical model. |
| 5 | `NaN` data_values preserved as SQL NULL | Loader `num_or_none()` | PLACES suppresses some county-measure cells; dropping those rows would skew per-county averages. NULL propagates correctly through SQL aggregates. |
| 6 | Year mix accepted: 2022 BRFSS for 4 measures, 2023 BRFSS for 36 | Loader sets `notes` on the 4 BRFSS-2022 measures | The 2025 release is hybrid: BPHIGH, BPMED, CHOLSCREEN, and HIGHCHOL still use 2022 BRFSS pending updated estimates. Phase 3 burden query picks the latest year per measure (open item in QUESTIONS.md "Phase 3 burden query"). |
| 7 | County centroids parsed from PLACES `Geolocation` POINT(lon lat) | Loader `extract_lat_lon()` | We use these for Phase 4 choropleth/map plotting. Loader verifies all 82 are non-NULL after load (Q-check `centroid_coverage`). |
| 8 | All 40 measures load; only 10 are flagged `is_in_burden_composite=1` | Loader applies D-011 | The other 30 stay queryable for ad-hoc Q&A; the burden composite is intentionally scoped (D-011 rationale). |

### 2.2 CDC/ATSDR SVI 2022 — per-state county file

| # | Step | Where it happens | Justification |
|---|---|---|---|
| 1 | County FIPS read from `STCNTY`; `FIPS` column ignored as a value-identical duplicate | Loader `load_social_vulnerability()` | Phase 1 verified `STCNTY == FIPS` across all 82 rows (QUESTIONS.md "SVI duplicate FIPS columns"). |
| 2 | -999 sentinel values coerced to SQL NULL | Loader `coerce_svi_number()` (D-014) | -999 is CDC's missing-value convention; treating it as a real number would bias percentile and average calculations. |
| 3 | CHECK constraints catch any -999 that slips through coercion | Schema (D-014 tripwire) | RPL_* columns: `BETWEEN 0 AND 1`. EP_* columns: `BETWEEN 0 AND 100`. A missed coercion would hard-fail the INSERT. |
| 4 | 158 SVI columns narrowed to 21 analytically-used columns | Loader `load_social_vulnerability()` | Margins of error, raw counts, and individual-variable percentiles aren't part of the analytical model. The 5 RPL_* rankings + ~15 EP_* estimates carry the relevant signal. |
| 5 | RPL_* values treated as intra-state percentiles | Documented in data dictionary | Because we pulled the per-state file (D-007), rankings are county-vs-county within Mississippi — exactly what a state-level equity index needs. |

### 2.3 CMS NPPES — May 2026 monthly snapshot

| # | Step | Where it happens | Justification |
|---|---|---|---|
| 1 | National 1.13 GB ZIP downloaded, streamed in 200k-row chunks | Phase 1 (Sat 21:54) | The national file is too large to ship in the 25 MB submission ZIP (D-008). |
| 2 | Filtered to `Provider Business Practice Location Address State Name = 'MS'` | Phase 1 stream filter | 56,806 MS practice rows out of 9,551,447 national. |
| 3 | Filtered to the 6 HRSA-aligned primary-care taxonomies | Phase 1 stream filter (D-008) | Matches HRSA's primary-care HPSA definition. Yields 6,404 active providers. |
| 4 | Deactivated NPIs dropped (`NPI Deactivation Date` is blank for retained rows) | Phase 1 stream filter | Active practice is the right denominator for "capacity"; deactivated providers don't serve patients. |
| 5 | National file (11.4 GB CSV + 1.13 GB ZIP) deleted post-filter | Phase 1 (Sat 21:55) | Reclaimed ~12 GB disk. Logged in D-008 deletion log. |
| 6 | ZIPs sliced to first 5 chars | Loader `pad_zip5()` | Some NPPES ZIPs are 9-char ZIP+4 strings (no dash); we use the 5-char ZCTA portion for county attribution (QUESTIONS.md "NPPES ZIP+4 strings"). |
| 7 | County FIPS derived via ZCTA crosswalk | Loader `load_providers()` (D-010) | NPPES has no native county column. We join `practice_zip5` → `zcta_county_crosswalk.zcta5 WHERE is_assigned = 1`. |
| 8 | Unmatched ZIPs preserved with `fips = NULL` (audit trail) | Loader `load_providers()` | 14 of 262 unique practice ZIPs don't appear as MS ZCTAs (cross-dataset reconciliation, §3). |
| 9 | NPI length-10 CHECK enforced | Schema | Standard NPI is always 10 digits; a length mismatch would indicate a parse error and we want to know. |

### 2.4 Census ACS 2022 5-year (B01003)

| # | Step | Where it happens | Justification |
|---|---|---|---|
| 1 | API call with `CENSUS_API_KEY` (in `.env`, gitignored) | Phase 1 | The Census API requires an activated key (resolved during Phase 1 after the user clicked the activation email — QUESTIONS.md "Census ACS key activation"). |
| 2 | `state || county` synthesized into 5-char FIPS | Phase 1 | Census API returns `state` and `county` as separate columns; we concatenate with zero-padding. |
| 3 | Population cast to int; non-positive values rejected at INSERT | Schema CHECK `population > 0` | Sanity guard. |
| 4 | County name stripped of `, Mississippi` suffix | Loader `load_counties()` | Schema stores `Hinds County`, not `Hinds County, Mississippi`. The bare `Hinds` is what region-assignment uses. |

### 2.5 Census 2020 ZCTA-County Relationship File

| # | Step | Where it happens | Justification |
|---|---|---|---|
| 1 | Pipe-delimited national file (~6.8 MB, 47,863 rows) parsed with UTF-8 BOM handling | Phase 1 | Census file uses `|` as separator and ships a UTF-8 BOM. |
| 2 | Filtered to MS county FIPS `28xxx` | Phase 1 | 771 MS ZCTA-county intersection rows (428 unique ZCTAs across all 82 counties). |
| 3 | Largest-population assignment computed at load | Loader `load_zcta_crosswalk()` (D-010) | 230 of 428 MS ZCTAs span multiple counties; the population-largest county is the highest-probability practice location. |
| 4 | `is_assigned = 1` flag persisted on exactly one row per ZCTA | Loader `load_zcta_crosswalk()` | Other intersection rows kept with `is_assigned = 0` so the raw fact is auditable. |
| 5 | Provider→county join reads `is_assigned = 1` rows back from the DB | Loader `load_providers()` | Single source of truth — the rule isn't re-implemented in two places. |

## 3. Cross-dataset reconciliation

### 3.1 Four-way FIPS alignment

| Dataset           | Distinct MS FIPS | Match |
|-------------------|-----------------:|-------|
| PLACES            | 82               | ✅    |
| SVI               | 82               | ✅    |
| Census ACS        | 82               | ✅    |
| ZCTA crosswalk    | 82               | ✅    |

`PLACES ∩ SVI ∩ ACS ∩ XWALK = exactly the same 82 counties`. Verified
during Phase 1 step E and re-verified by `check_fips_coverage` in the
quality script.

### 3.2 NPPES → county attribution

NPPES has no native county column; we attribute via ZIP. Of the 262
unique practice ZIPs in the MS NPPES subset:

| Status | Count | % |
|---|---:|---:|
| Matched to a MS ZCTA | 248 | 94.7 % |
| **Not matched** | **14** | **5.3 %** |
| &nbsp;&nbsp;PO-box-only ZIPs not enumerated as ZCTAs | 13 | |
| &nbsp;&nbsp;`36345` (Alabama border ZIP, Dale/Henry/Houston, AL) | 1 | |
| &nbsp;&nbsp;`33804` (Lakeland, FL — likely provider typo) | 1 | |

The 14 unmatched ZIPs are excluded from county aggregations but
preserved in the `providers` table with `fips = NULL` so the audit
trail is intact. `check_nppes_zip_coverage` asserts coverage ≥ 90 %.

### 3.3 SVI vs ACS population sanity

`social_vulnerability.e_totpop` (SVI's own population estimate) is
loaded alongside `counties.population` (ACS B01003). The two come from
overlapping ACS vintages and should be within ~5 % of each other per
county; a future Phase-3.5 query can surface large divergences if any.

## 4. Known limitations

| # | Limitation | Where documented |
|---|---|---|
| 1 | Rural flag uses a 50,000-population proxy, not USDA RUCC codes | Data dictionary (`counties`); upgrade path noted |
| 2 | NPPES "active" = "not deactivated" = "enrolled in NPPES" — overstates effective practicing capacity | QUESTIONS.md "NPPES provider counts overstate effective capacity" |
| 3 | PLACES Year mix (4 measures on 2022 BRFSS, 36 on 2023) — Phase 3 must pick latest per measure | QUESTIONS.md "Phase 3 burden query must explain the PLACES year mix" |
| 4 | DeSoto County is in Delta per MDRA but is functionally Memphis-suburban; an outlier within Delta health metrics | D-013 borderline-cases note |
| 5 | 14 NPPES practice ZIPs don't resolve to a county (PO-box / cross-state); excluded from capacity counts | §3.2 above; D-010 |
| 6 | Multi-county ZCTAs (54 % of MS) assigned to a single county by largest-population rule; some providers will be counted in a "wrong" county whose ZIP they share | D-010; data dictionary `zcta_county_crosswalk` |
| 7 | PLACES suppresses some county-measure cells; loaded as NULL, naturally excluded from per-county averages but reduces sample sizes for those measures | Loader `num_or_none` |

## 5. Validation results

The companion script `python/01b_data_quality_checks.py` runs a
battery of independent assertions against the loaded database and
writes the result to `data/processed/data_quality_report.txt`. The
checks include:

- Row counts per table match expected (9 sub-checks)
- FIPS coverage = 82 for every county-keyed table (4 sub-checks)
- No orphan foreign keys (`PRAGMA foreign_key_check` returns no rows)
- All 82 county centroids are non-NULL
- Population, prevalence, percentile, and percentage values are in
  plausible ranges
- NPPES ZIP coverage ≥ 90 % (D-010 threshold)
- Burden composite has exactly the 10 measures from D-011
- Polarity spot-check: `CHECKUP` and `CHOLSCREEN` both `polarity = −1`
  with `is_in_burden_composite = 1`; `DIABETES` `polarity = +1` with
  `is_in_burden_composite = 1`
- `data_sources` has 5 rows, all with non-NULL `rows_loaded`
- `provider_capacity.sum(provider_count)` equals the count of providers
  with non-NULL FIPS

**Where to look:** `data/processed/data_quality_report.txt` is rewritten on
every run of the quality script. The script's exit code is `0` on success
and `1` on any failure; `run_pipeline.py` (Phase 5) will treat a non-zero
exit as a hard stop.

## 6. Reproducing this report

```bash
# From the project root
python python/01_load_data.py             # rebuild database.db from data/raw/
python python/01b_data_quality_checks.py  # validate and write data/processed/data_quality_report.txt
```

Both scripts are idempotent. Re-running them against the same raw CSVs
produces a bit-identical database and an identical quality report.

## 7. References

- `DECISIONS.md` D-001..D-015 — every cleaning-relevant judgment call
- `QUESTIONS.md` — resolved and open items by phase
- `schema/create_tables.sql` — schema with CHECK / FK constraints
- `schema/data_dictionary.md` — column-by-column reference
- `python/01_load_data.py` — the loader (code is canonical)
- `python/01b_data_quality_checks.py` — the validator
- `data/processed/data_quality_report.txt` — the latest run's report
