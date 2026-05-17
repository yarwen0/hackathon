# Open Questions & Data Oddities

Running parking lot of things to confirm, decide, or ask about. Resolved
items get a strikethrough and a one-line resolution note.

## Resolved during Phase 3

- **D-010 largest-population rule produced 20% zero-provider counties.**
  Discovered while reviewing q03 (capacity ranking) output: 16 of 82
  counties showed zero attributed primary-care providers. Diagnostic
  workflow: (1) review of q03 surfaced implausibly tied top-5 at
  capacity_gap_score=100; (2) drilled into one example county (Clay,
  pop 18,598) to inspect its ZCTA crosswalk rows; (3) discovered Clay's
  county-seat ZIP 39773 (West Point) was being assigned to Monroe County
  purely because Monroe's total population is larger, despite 95% of ZIP
  39773's land area sitting in Clay; (4) root-caused to the
  largest-population assignment rule systematically favoring larger
  neighbors. Resolved by amending D-010 to use largest-AREALAND_PART
  instead. Reload took 0.66s; zero-provider count dropped 16 → 1
  (Issaquena, pop 1,206 — plausibly real). See D-010 AMENDMENT in
  DECISIONS.md and the new section in docs/data_cleaning_report.md.

## Resolved during Phase 1

- **Census ACS key activation:** First call returned the `invalid_key.html`
  page even though the key had the right 40-hex format. Cause: Census
  requires the key be activated via the email link before it's usable.
  Resolved after user clicked the activation link. No code change needed.

- **HUD crosswalk requires login; switched to Census ZCTA.** Original
  D-010 proposal was HUD USPS ZIP_COUNTY (Item 2 from user). HUD download
  portal requires HUD USER account + email confirmation. Switched to the
  Census 2020 ZCTA-County Relationship File (no login). NPPES match rate
  94.7% — above the 90% bar set by the user. See D-010.

- **ZCTA-NPPES match rate: 94.7%.** Of 262 unique NPPES MS practice ZIPs,
  248 match a MS ZCTA. 13 are PO-box-only ZIPs not enumerated as ZCTAs;
  1 is an out-of-state ZIP (Alabama border) likely a data entry anomaly;
  1 is a likely Florida typo. All 14 are excluded from county-level
  capacity counts and documented in the data cleaning report.

- **54% of MS ZCTAs span multiple counties.** 230 of 428 MS ZCTAs cross
  county lines. Resolved by D-010's largest-population-county
  assignment rule (Phase 2 implements).

- **PLACES "2024 release" URL now serves 2025.** The Socrata dataset ID
  `swc5-untb` was reused when CDC dropped the 2025 release on 2024-12-23.
  Original D-003 specified 2024; switched to 2025 with user approval. See
  D-006 amendment.

- **PLACES MS contains BOTH Year=2022 and Year=2023.** The 2025 release
  is a hybrid: most measures use 2023 BRFSS, but four
  (BPHIGH/CHOLSCREEN/HIGHCHOL/BPMED) still use 2022 BRFSS pending updated
  estimates. We will keep both years in the schema and let Phase 3 SQL pick
  the latest per-measure Year. Not a defect — documented behavior of PLACES.

- **PLACES county FIPS column is `LocationID`, not `CountyFIPS`.** D-006
  originally said `CountyFIPS`; corrected.

- **SVI has two FIPS-shaped columns (`STCNTY` and `FIPS`).** Verified
  pairwise equal across all 82 MS rows. We use `STCNTY` in the schema; `FIPS`
  is the same value (the file uses `FIPS` as a convenience alias).

## Open

- **Phase 3 burden query must explain the PLACES year mix.** The 2025
  PLACES release covers 82 MS counties × 40 measures across `Year` 2022
  AND 2023. Phase 3's burden SQL must include a header comment explaining
  why we pick the latest year per measure (4 measures still on 2022 BRFSS,
  the rest on 2023). This is critical for the presentation defense.

- **01b DQ check must verify all 82 county centroids are non-NULL.**
  `counties.latitude` and `counties.longitude` are nullable in the schema
  (extracted from PLACES `Geolocation` POINT values), but Phase 4's
  choropleth and Plotly maps require complete coverage. The data quality
  check script (Phase 2 Step F) must add a hard assertion that all 82
  counties have non-NULL lat/lon — fail with non-zero exit code if any
  county is missing a centroid.

- **q06 must include a `driver_profile` column to make D-019 transparency
  visible, not just available.** D-019 promises transparency on
  single-component-driven counties by exposing all 3 components in
  `v_equity_gap_index` (D-018). To make this transparency *visible* rather
  than just *available*, q06 (top-10 underserved) must derive a column:
  ```
  CASE
      WHEN (max_component - second_max_component) > 30 THEN 'single-component dominant'
      WHEN (max_component - second_max_component) > 15 THEN 'one component leading'
      ELSE 'multi-component'
  END AS driver_profile
  ```
  This lets a judge or stakeholder reading the top-10 table immediately see
  whether each top-ranked county is "stacked" across all 3 pillars or
  driven by one extreme component (e.g., Issaquena's capacity_component=100).

- **Some NPPES ZIPs may be 9-digit (ZIP+4) strings without dash.**
  Quick scan shows 9-character ZIPs in the raw column. We slice to first 5
  for FIPS lookup; document this in the data cleaning report.

- **PLACES has 40 measures.** We may want to scope to a subset for the
  burden composite (e.g., 8–12 core chronic-disease measures: obesity,
  diabetes, hypertension, COPD, depression, etc.) rather than averaging
  all 40. Decision deferred to Phase 3 with a documented rationale.

- **NPPES provider counts overstate effective capacity.** An NPI represents
  enumeration, not active practice; some providers practice in multiple
  states or are semi-retired. We accept this as a known limitation and
  document it in the limitations section of the README.
