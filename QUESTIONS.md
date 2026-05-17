# Open Questions & Data Oddities

Running parking lot of things to confirm, decide, or ask about. Resolved
items get a strikethrough and a one-line resolution note.

## Resolved during Phase 1

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

- **Census API key not yet provided.** Step B4 of Phase 1 (ACS download)
  is blocked. .env scaffolding in place; awaiting key paste.

- **NPPES has no county FIPS column.** Need a ZIP-to-county crosswalk in
  Phase 2 to derive county from the 5-digit practice ZIP. Decision pending
  on HUD USPS quarterly crosswalk vs Census ZCTA approach.

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
