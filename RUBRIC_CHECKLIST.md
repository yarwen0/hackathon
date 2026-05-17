# Rubric & Bonus Checklist

> Every line of the official instructions mapped to a specific deliverable.
> Update as work completes. Run a final audit before submitting Sunday.

## Phase progress note (as of end of Phase 1, 2026-05-16)

Phase 1 itself produces no submitted rubric deliverables — those start in
Phase 2 (schema) and Phase 3 (queries). However, Phase 1 establishes the
factual basis for two rubric categories:

- **Data Understanding & Schema Design** — All 5 source datasets (PLACES,
  SVI, NPPES filtered, Census ACS, ZCTA crosswalk) are now characterized:
  row counts, column names, FIPS handling, year vintages, and known
  anomalies are documented in `DECISIONS.md` (D-001..D-010) and
  `QUESTIONS.md`. Schema design begins in Phase 2 with this foundation.
- **Data Cleaning Workflows (bonus)** — Cleaning decisions made in Phase 1
  (NPPES taxonomy filter, NPPES deactivation drop, ZCTA multi-county
  assignment rule, 14 unmatched-ZIP exclusions, PLACES year-mix handling
  policy, SVI duplicate-column reconciliation) are logged in DECISIONS.md
  and will be formalized into `docs/data_cleaning_report.md` in Phase 2.

Boxes below are ticked only when the actual deliverable file exists.



## Challenge Requirement 1: Data Organization & Database Design

- [x] Explored and understood datasets → see `python/01b_data_quality_checks.py` output + report
- [x] Data cleaned and prepared → see `docs/data_cleaning_report.md`
- [x] Structured SQL database designed → `database.db` (SQLite, 9 tables, all CHECKs/FKs enforced)
- [x] Tables defined → 9 tables: counties (hub), data_sources, measures, taxonomies, zcta_county_crosswalk, health_indicators, social_vulnerability, providers, provider_capacity
- [x] Relationships defined → 8 FK relationships, ER diagram at `schema/er_diagram.png`
- [x] Primary keys defined → every table has a PK (single or composite); see `schema/create_tables.sql`
- [x] Data types specified → SQLite-native TEXT/INTEGER/REAL with CHECK constraints; see `schema/create_tables.sql`
- [x] Assumptions documented → `DECISIONS.md` D-001..D-015
- [x] Schema decisions documented → `DECISIONS.md` + `schema/data_dictionary.md`
- [x] Data transformations documented → `docs/data_cleaning_report.md`
- [x] Normalization choices documented → `DECISIONS.md` D-015 (regions as column not table), D-011 (long-form measures), D-008 (taxonomy table)

## Challenge Requirement 2: SQL & Data Querying

- [x] Database queryable in SQL → `database.db`
- [x] Trend identification → q01 (state-mean burden across 10 measures), q02 (county burden ranking), q03 (county capacity ranking)
- [x] Aggregated metrics → q01 (state scope + capacity totals), q07 (Delta/Non-Delta + Rural/Urban summaries)
- [x] Geographic region comparison → q07 Section A (Delta vs Non-Delta; mean EGI 69.56 vs 53.24)
- [x] Population group analysis → q04 (vulnerability quintiles + dominant SVI theme per county), q07 Section B (Rural vs Urban)
- [x] Public health indicators analyzed → all 8 queries
- [x] Meaningful SQL queries included → 8 commented `.sql` files in `/sql/` + 1 SQL VIEW (`v_equity_gap_index`)
- [ ] Python/Pandas supporting analysis → `python/03_statistical_analysis.py` PENDING Phase 3.5; `python/02_visualize.py` PENDING Phase 4

## Challenge Requirement 3: Analysis & Insights

- [x] Insights valuable to healthcare professionals → top-10 underserved counties (q06) with driver_profile (8 multi-component, 2 one-leading)
- [x] Insights for researchers → statistical validation done: r=0.734 component correlation limitation flagged; OLS shows Delta effect fully mediated by underlying components; bootstrap reveals top-5 statistical cluster
- [x] Insights for hospital leadership → capacity gap analysis (q03) + per-county drivers (q08) showing Obesity+BP dominate, Issaquena uniquely zero providers
- [ ] Insights for public health organizations → "tool for the Gulf South Center" framing in README + presentation — PENDING (Phase 5/6)

## Challenge Requirement 4: Visualization

- [x] Visualizations clearly communicate findings → 5 viz files in `/visualizations/` (+ `correlation_heatmap.png` from Phase 3.5 = 6 total)
- [x] Geographic / map-based viz → `mississippi_egi_map.html` (interactive) + `mississippi_egi_map.png` (static, slide-ready); Delta cluster visible, Issaquena callout, top-10 black borders
- [x] Charts → `top10_bar.png` (stacked horizontal), `drivers_grid.png` (2x5 small multiples), `correlation_heatmap.png`
- [x] Graphs → `burden_capacity_scatter.png` (82 counties, viridis vulnerability color, Issaquena gold-star highlight, danger-zone shading)
- [x] Tables → `full_ranking.csv` (82 rows, all 10 EGI columns)
- [x] Summary visuals → `drivers_grid.png` shows component profile + driver_profile annotation per top-10 county

## Challenge Requirement 5: Presentation

- [ ] 6-minute virtual presentation prepared → `presentation.pdf` (9 slides)
- [ ] Explains approach → slides 4–5
- [ ] Explains datasets used → slide 4
- [ ] Explains findings → slides 6–7
- [ ] Explains conclusions → slide 8
- [ ] Understandable to technical audience → schema diagram, SQL terminology
- [ ] Understandable to non-technical audience → hook is plain English, "so what" frames real-world use

## Evaluation Criteria Coverage

- [x] Data Understanding & Schema Design → 9-table normalized schema + ER diagram + data dictionary (DECISIONS.md D-011..D-015)
- [ ] Querying & Analysis → 8 SQL files with CTEs, window functions, joins
- [ ] Insight Generation → composite EGI, top-10 ranking, driver breakdown, regional comparison
- [ ] Visualization → 6 charts including interactive choropleth
- [ ] Communication → README punchline opener + 9-slide deck + dual-audience design
- [ ] Creativity & Initiative → original composite index, "decision tool" framing

## BONUS CONSIDERATIONS (ALL SIX MUST BE TICKED)

- [x] **Advanced SQL techniques** → CTEs throughout (10 chained in q05, 6 in q08), DENSE_RANK + NTILE(5) in q02/q03/q04/q05, MIN/MAX OVER PARTITION BY in q02/q05, MIN/MAX OVER () in q03/q05, CASE chains in q04/q08, UNPIVOT via UNION ALL in q06, ROW_NUMBER() OVER PARTITION BY in q06/q07/q08, conditional MAX aggregation for pivots in q06/q08, CREATE VIEW + DROP VIEW IF EXISTS in q05, scalar max() in q04, CROSS JOIN constants in q05.
- [x] **Data cleaning workflows** → `python/01b_data_quality_checks.py` (27 checks all PASS) + `docs/data_cleaning_report.md`
- [x] **Statistical analysis** → `python/03_statistical_analysis.py` ran clean: Pearson (burden↔vulnerability r=0.734 — flagged double-counting limitation); OLS (R²=0.978, 3 of 4 predictors significant, is_delta fully mediated); Bootstrap CI (1,000 iterations, top-5 statistically clustered); z-score outliers (4 low-side hubs only)
- [ ] **Automation** → `run_pipeline.py` regenerates entire project in one command
- [x] **Interactive visualizations** → Plotly choropleth `mississippi_egi_map.html` (10.8 MB standalone, hover tooltips per county with rank/EGI/3 components); PNG screenshot also saved for slides
- [ ] **Additional research / contextual analysis** → `docs/context_and_background.md` with 3-5 cited sources

## Submission Requirements

- [ ] Submitted by Sunday, May 17, 2026, 6:00 PM
- [ ] Sent to corey.welborn@usm.edu
- [ ] Email subject: `Hackathon2026_Round1_LastName_FirstName`
- [ ] ZIP named: `LastName_FirstName_Round1.zip`
- [ ] Contains: Presentation.pdf
- [ ] Contains: README.md
- [ ] Contains: Source code (python/, sql/)
- [ ] Contains: SQL scripts (sql/)
- [ ] Contains: Visualizations (visualizations/)
- [ ] Contains: GitHub link in README (optional but included for credibility)
- [ ] README has: project overview
- [ ] README has: datasets used
- [ ] README has: key findings/insights
- [ ] README has: setup instructions
- [ ] Presentation communicates: project focus
- [ ] Presentation communicates: datasets used
- [ ] Presentation communicates: schema/organizational approach
- [ ] Presentation communicates: analysis methods
- [ ] Presentation communicates: visualizations
- [ ] Presentation communicates: findings and conclusions
- [ ] NO `node_modules/` in ZIP
- [ ] NO `venv/` in ZIP
- [ ] NO `dist/` in ZIP
- [ ] NO `build/` in ZIP
- [ ] NO cache directories in ZIP
- [ ] If ZIP > 25 MB → cloud link included instead

## Final pre-submission audit
- [ ] Every checkbox above is ticked
- [ ] `run_pipeline.py` tested from clean state — works end-to-end
- [ ] README opens with the punchline finding (not "Hello, this is my project")
- [ ] Presentation rehearsed 3+ times, lands at 5:45–5:55
- [ ] Email drafted, ZIP attached, link tested
- [ ] Submit