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
- [ ] `sql/q01_state_overview.sql` — MS vs national baseline
- [ ] `sql/q02_burden_ranking.sql` — counties ranked by burden (RANK, NTILE)
- [ ] `sql/q03_capacity_ranking.sql` — counties ranked by capacity scarcity (window functions)
- [ ] `sql/q04_vulnerability_layer.sql` — SVI joined to health data (JOINs, CASE)
- [ ] `sql/q05_equity_gap_index.sql` — **headline query** with CTEs, normalization, weighted aggregation
- [ ] `sql/q06_top_underserved.sql` — top 10 with component breakdown
- [ ] `sql/q07_regional_patterns.sql` — Delta vs non-Delta, rural vs urban
- [ ] `sql/q08_drivers_analysis.sql` — per-county driver identification
- [ ] All queries have header comments (purpose, tables used, output meaning)
- [ ] All queries tested against database.db; results saved as CSVs in `data/processed/`
- [ ] Update DECISIONS.md (weighting rationale, normalization method)
- [ ] Commit to git

## Phase 3.5: Statistical Analysis (~1.5 hrs)
- [ ] Write `python/03_statistical_analysis.py`
- [ ] Pearson correlation matrix across burden/capacity/SVI/EGI
- [ ] OLS regression: EGI ~ pcp_per_10k + svi_overall + rural + region
- [ ] Bootstrap confidence intervals for top-10 EGI scores (1000 iterations)
- [ ] Outlier detection (z-score > 2 on EGI)
- [ ] Save `visualizations/correlation_heatmap.png`
- [ ] Save stats summary to `data/processed/statistical_results.txt`
- [ ] Document findings in DECISIONS.md
- [ ] Commit to git

## Phase 4: Visualizations (~3 hrs)
- [ ] `python/02_visualize.py` — produces all charts from SQLite views
- [ ] Plotly choropleth → `visualizations/mississippi_equity_gap_map.html` + `.png`
   - Hover tooltips with county name, EGI rank, components
   - Green-to-red color scale
- [ ] Top 10 horizontal bar chart → `visualizations/top10_underserved.png`
   - Stacked segments showing burden/capacity/vulnerability contribution
- [ ] Driver grid (small multiples) → `visualizations/drivers_grid.png`
- [ ] Burden vs capacity scatter → `visualizations/burden_vs_capacity_scatter.png`
   - Colored by SVI, top-10 labeled, "danger zone" highlighted
- [ ] Full ranking CSV → `visualizations/full_ranking.csv`
- [ ] All charts consistent in style, color palette, fonts
- [ ] Commit to git

## Phase 5: Automation, Notebook, Docs (~2.5 hrs)
- [ ] Write `run_pipeline.py` — single command runs Phases 1b → 4
- [ ] Test `run_pipeline.py` end-to-end on clean state
- [ ] Build Jupyter notebook `notebooks/analysis_walkthrough.ipynb`
- [ ] Write `docs/context_and_background.md` — MS health context, 3-5 cited sources
- [ ] Write final README.md (punchline opener → setup → datasets → methodology → findings → limitations → future work)
- [ ] Finalize DECISIONS.md
- [ ] Update RUBRIC_CHECKLIST.md — verify every item ticked
- [ ] Commit to git

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