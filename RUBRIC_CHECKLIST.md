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

- [ ] Explored and understood datasets → see `python/01b_data_quality_checks.py` output
- [ ] Data cleaned and prepared → see `docs/data_cleaning_report.md`
- [ ] Structured SQL database designed → `database.db` (SQLite)
- [ ] Tables defined → 4 tables: counties, health_indicators, social_vulnerability, provider_capacity
- [ ] Relationships defined → FKs from fact tables to counties.fips
- [ ] Primary keys defined → see `schema/create_tables.sql`
- [ ] Data types specified → see `schema/create_tables.sql`
- [ ] Assumptions documented → `DECISIONS.md`
- [ ] Schema decisions documented → `DECISIONS.md` + `schema/data_dictionary.md`
- [ ] Data transformations documented → `docs/data_cleaning_report.md`
- [ ] Normalization choices documented → `DECISIONS.md`

## Challenge Requirement 2: SQL & Data Querying

- [ ] Database queryable in SQL → `database.db`
- [ ] Trend identification → q01, q02, q03
- [ ] Aggregated metrics → q01, q07
- [ ] Geographic region comparison → q07 (Delta vs non-Delta)
- [ ] Population group analysis → q04 (vulnerability tiers)
- [ ] Public health indicators analyzed → all 8 queries
- [ ] Meaningful SQL queries included → 8 commented `.sql` files in `/sql/`
- [ ] Python/Pandas supporting analysis → `python/02_visualize.py`, `python/03_statistical_analysis.py`

## Challenge Requirement 3: Analysis & Insights

- [ ] Insights valuable to healthcare professionals → top-10 underserved counties (q06)
- [ ] Insights for researchers → statistical validation (`03_statistical_analysis.py`)
- [ ] Insights for hospital leadership → capacity gap analysis (q03)
- [ ] Insights for public health organizations → "tool for the Gulf South Center" framing in README + presentation

## Challenge Requirement 4: Visualization

- [ ] Visualizations clearly communicate findings → 6 charts in `/visualizations/`
- [ ] Geographic / map-based viz → `mississippi_equity_gap_map.html` + `.png`
- [ ] Charts → `top10_underserved.png`, `drivers_grid.png`, `correlation_heatmap.png`
- [ ] Graphs → `burden_vs_capacity_scatter.png`
- [ ] Tables → `full_ranking.csv`
- [ ] Summary visuals → `drivers_grid.png` shows summary per top-10 county

## Challenge Requirement 5: Presentation

- [ ] 6-minute virtual presentation prepared → `presentation.pdf` (9 slides)
- [ ] Explains approach → slides 4–5
- [ ] Explains datasets used → slide 4
- [ ] Explains findings → slides 6–7
- [ ] Explains conclusions → slide 8
- [ ] Understandable to technical audience → schema diagram, SQL terminology
- [ ] Understandable to non-technical audience → hook is plain English, "so what" frames real-world use

## Evaluation Criteria Coverage

- [ ] Data Understanding & Schema Design → 4-table normalized schema + ER diagram + data dictionary
- [ ] Querying & Analysis → 8 SQL files with CTEs, window functions, joins
- [ ] Insight Generation → composite EGI, top-10 ranking, driver breakdown, regional comparison
- [ ] Visualization → 6 charts including interactive choropleth
- [ ] Communication → README punchline opener + 9-slide deck + dual-audience design
- [ ] Creativity & Initiative → original composite index, "decision tool" framing

## BONUS CONSIDERATIONS (ALL SIX MUST BE TICKED)

- [ ] **Advanced SQL techniques** → CTEs in q05, RANK/NTILE/PERCENT_RANK in q02/q03/q06
- [ ] **Data cleaning workflows** → `python/01b_data_quality_checks.py` + `docs/data_cleaning_report.md`
- [ ] **Statistical analysis** → `python/03_statistical_analysis.py` (Pearson, OLS, bootstrap CI, outliers)
- [ ] **Automation** → `run_pipeline.py` regenerates entire project in one command
- [ ] **Interactive visualizations** → Plotly choropleth saved as standalone HTML
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