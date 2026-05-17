# Project Plan — Phase Tracker

> Time budget: ~48 hours from Saturday afternoon to Sunday 6 PM.
> Update checkboxes as work completes. Update DECISIONS.md and RUBRIC_CHECKLIST.md in parallel.

## Phase 0: Setup (~1 hr) — Saturday afternoon
- [x] Folder structure created
- [x] Virtual environment activated
- [x] requirements.txt drafted
- [x] All packages installed and importable
- [x] Git initialized, first commit made
- [x] Claude Code installed and launched
- [x] CLAUDE.md, PROJECT_PLAN.md, RUBRIC_CHECKLIST.md, QUESTIONS.md, .gitignore in place

## Phase 1: Data Acquisition (~2 hrs)
- [x] Download CDC PLACES county data → `data/raw/places_county_ms_2025.csv`
- [x] Download CDC SVI county data → `data/raw/svi_county_ms_2022.csv`
- [x] Download HRSA AHRF or CMS provider data → `data/raw/cms_nppes_ms_primary_care_2026-05.csv`
- [x] Download Census ACS county population → `data/raw/census_acs_county_population_ms_2022.csv`
- [x] Download ZCTA-to-county crosswalk (Phase 2 prerequisite) → `data/raw/census_zcta_county_crosswalk_ms_2020.csv`
- [x] Inspect each file: row counts, columns, FIPS format (5-digit string, leading zeros preserved)
- [x] Confirm Mississippi rows present (state FIPS = 28, ~82 counties) — PLACES 82, SVI 82, ACS 82, ZCTA crosswalk 82, NPPES 6,404 providers
- [x] Confirm FIPS join keys align across all datasets — 4-way match: PLACES = SVI = ACS = XWALK = exactly the same 82 counties; NPPES->FIPS via ZCTA crosswalk in Phase 2 (94.7% match rate)
- [x] Document any data oddities found in QUESTIONS.md
- [x] Commit to git

## Phase 2: Schema Design & Ingestion (~3 hrs)
- [x] Draft ER diagram (mermaid source in schema/er_diagram.md)
- [x] Export ER diagram to `schema/er_diagram.png` (matplotlib local render)
- [x] Write `schema/create_tables.sql` — 9 tables, PKs/FKs/CHECKs, idempotent DROPs, indexes
- [x] Write `schema/data_dictionary.md` — column-by-column reference + 4 required paragraphs
- [x] Write `python/01_load_data.py` — single-transaction loader, all rules from D-011/D-013/D-014
- [x] Write `python/01b_data_quality_checks.py` — 27 checks, exit non-zero on failure
- [x] Write `docs/data_cleaning_report.md` — bonus deliverable, cites every D-XXX
- [x] Run loader; verify `database.db` populated correctly (all 9 tables, exit 0)
- [x] Update DECISIONS.md (D-011..D-015)
- [x] Commit to git

## Phase 3: Analytical SQL (~4 hrs)
- [x] `sql/q01_state_overview.sql` — MS-wide context (provenance + scope + top burdens)
- [x] `sql/q02_burden_ranking.sql` — counties ranked by burden (DENSE_RANK, NTILE, per-measure normalization)
- [x] `sql/q03_capacity_ranking.sql` — counties ranked by capacity scarcity (DENSE_RANK, NTILE, inverted min-max)
- [x] `sql/q04_vulnerability_layer.sql` — SVI joined to health data (4-table JOINs, CASE for dominant_theme, NTILE)
- [x] `sql/q05_equity_gap_index.sql` — **HEADLINE** — 10-CTE composite, DENSE_RANK, CREATE VIEW v_equity_gap_index; #1 = Issaquena (EGI 87.35), verified
- [x] `sql/q06_top_underserved.sql` — top 10 with component breakdown + driver_profile (UNPIVOT + ROW_NUMBER; 8/10 multi-component, 2 "one leading", 0 single-dominant)
- [x] `sql/q07_regional_patterns.sql` — Delta vs non-Delta + rural vs urban (2 result sets; Delta mean EGI 69.56 vs Non-Delta 53.24; Rural 61.37 vs Urban 36.49)
- [x] `sql/q08_drivers_analysis.sql` — per-county drivers for top-10 (6 CTEs; Obesity + BP dominate; Issaquena = only county with has_zero_providers=1)
- [x] All 8 queries have header comments (purpose, tables, techniques, output, design)
- [x] All 8 queries tested against database.db; 9 CSVs saved to `data/processed/`
- [x] DECISIONS.md updated (D-016 weighting, D-017 view, D-018 component exposure, D-019 no floor)
- [x] Commit to git — "Phase 3 complete: 8 analytical SQL files + EGI view"

## Phase 3.5: Statistical Analysis (~1.5 hrs)
- [x] Write `python/03_statistical_analysis.py`
- [x] Pearson correlation matrix across burden/capacity/vulnerability/EGI (max pair r=0.734 burden↔vulnerability)
- [x] OLS regression: EGI ~ pcp_per_10k + rpl_themes + is_rural + is_delta (R²=0.978; 3 of 4 significant; is_delta not significant — Delta effect fully mediated)
- [x] Bootstrap confidence intervals for top-10 EGI scores (1000 iter, seed=42; max CI width 13.31; 9/9 adjacent pairs overlap)
- [x] Outlier detection (z-score > 2; 4 low-side outliers, no high-side)
- [x] Save `visualizations/correlation_heatmap.png`
- [x] Save stats summaries: `data/processed/ols_regression_summary.txt`, `bootstrap_ci_top10.csv`, `outliers.txt`
- [x] Findings documented in `docs/presentation_talking_points.md` "Statistical validation findings"
- [x] Commit to git

## Phase 4: Visualizations (~3 hrs)
- [x] `python/02_visualize.py` — produces all 5 visualizations from `v_equity_gap_index` (5.0s wall time)
- [x] Plotly choropleth → `visualizations/mississippi_egi_map.html` + `.png` — hover tooltips, Issaquena callout, top-10 black borders, MS-zoomed
- [x] Top 10 horizontal bar chart → `visualizations/top10_bar.png` — weighted-contribution stacked segments sum to EGI
- [x] Drivers grid (2x5 small multiples) → `visualizations/drivers_grid.png` — driver_profile annotated per subplot
- [x] Burden vs capacity scatter → `visualizations/burden_capacity_scatter.png` — viridis vulnerability color, danger zone, Issaquena gold star
- [x] Full ranking CSV → `visualizations/full_ranking.csv` (copy of q05 full ranking)
- [x] All charts consistent: rcParams set once; same component palette (red/blue/purple) across V2/V3; DejaVu Sans, dpi=150, white facecolor
- [x] Commit to git

## Phase 5: Automation, Notebook, Docs (~2.5 hrs)
- [x] Write `run_pipeline.py` — single command runs Phases 1b → 4 (7.9s end-to-end)
- [x] Test `run_pipeline.py` end-to-end on clean state (exit 0, all 12 steps OK, all 9 row counts match)
- [ ] Build Jupyter notebook `notebooks/analysis_walkthrough.ipynb` (Phase 5 Part 2)
- [x] Write `docs/context_and_background.md` — MS health context, 9 cited sources (CDC PLACES, SVI, BRFSS, HRSA, CMS NPPES, County Health Rankings, America's Health Rankings, MS DRA, MSDH)
- [x] Write final README.md — punchline opener (Issaquena fact table) → datasets → methodology → schema → key findings → statistical validation → setup → limitations → future work → file structure
- [x] Finalize DECISIONS.md — TOC + "How to read this document" header + all 19 entries
- [x] Finalize docs/data_cleaning_report.md — added §3 (Phase 3 analytical decisions) and §4 (statistical validation findings)
- [x] Commit to git ("Phase 5 part 1")

## Phase 6: Presentation Deck (~2 hrs)
- [ ] Slide 1: Title
- [ ] Slide 2: Hook (specific finding, specific county)
- [ ] Slide 3: Problem framing
- [ ] Slide 4: Datasets & schema (with ER diagram)
- [ ] Slide 5: Methodology (the index formula)
- [ ] Slide 6: Headline visual (choropleth screenshot)
- [ ] Slide 7: Top 10 + driver breakdown
- [ ] Slide 8: "So what" — Gulf South Center use case
- [ ] Slide 9: Limitations + Q&A
- [ ] Export to `presentation.pdf`

## Phase 7: Package & Submit (~1 hr) — Sunday before 6 PM
- [ ] Final RUBRIC_CHECKLIST.md audit — all items ticked
- [ ] Remove venv/, __pycache__, .ipynb_checkpoints, .DS_Store
- [ ] Verify `run_pipeline.py` runs clean from raw data
- [ ] Create ZIP: `LastName_FirstName_Round1.zip`
- [ ] Check ZIP size (<25 MB ideal)
- [ ] If too big: upload to Google Drive, get shareable link
- [ ] Compose email with subject `Hackathon2026_Round1_LastName_FirstName`
- [ ] Send to corey.welborn@usm.edu
- [ ] Push final state to public GitHub repo, link in README

## Phase 8: Rehearse for Monday (~1.5 hrs) — Sunday evening + Monday morning
- [ ] Run 6-minute talk with stopwatch — 3 times
- [ ] Adjust slides based on pacing
- [ ] Anticipate 5 likely Q&A questions, prepare answers
- [ ] Verify Zoom/virtual setup
- [ ] Test screen-sharing the interactive HTML map