# Mississippi Health Equity Gap Index — Project Context

## What this project is
A 48-hour hackathon submission for the Gulf South Center for Community-Engaged Health Research and Innovation (Round 1 Backend Data Challenge). The prize is a paid summer research internship. We are optimizing to WIN — every rubric category and every bonus consideration must be hit.

## Deadline (hard)
- Submission: Sunday, May 17, 2026, 6:00 PM
- Virtual presentation: Monday, May 18, 2026, 1:00–3:00 PM
- Submit via email to corey.welborn@usm.edu
- Subject line: `Hackathon2026_Round1_LastName_FirstName`
- ZIP name: `LastName_FirstName_Round1.zip`
- If ZIP > 25 MB → upload to Google Drive, include shareable link in email

## The concept (LOCKED IN)
**Mississippi Health Equity Gap Index (EGI)** — a county-level composite index that combines health burden (CDC PLACES), provider capacity (HRSA/CMS + Census), and social vulnerability (CDC SVI) to rank Mississippi's 82 counties by underservedness. Output includes ranked counties, an interactive choropleth, driver breakdowns, statistical validation, and a one-command reproducibility pipeline.

## Headline finding (template — fill in real values during Phase 3)
"Of Mississippi's 82 counties, [TOP COUNTY] has the largest health equity gap in the state — residents face the [X]th-highest chronic disease burden but have access to fewer than [Y] primary care providers per 10,000 residents (state average: [Z]), in a community ranking in the top [N]% for social vulnerability."

## Tech stack (LOCKED IN)
- **Database:** SQLite (single file, ships with submission)
- **Languages:** Python 3.10+ and SQL
- **Libraries:** pandas, numpy, plotly, folium, matplotlib, seaborn, scipy, statsmodels, jupyter, openpyxl, requests
- **Notebooks:** Jupyter for end-to-end walkthrough
- **Visualization headline:** Plotly interactive choropleth of MS counties

## Folder structure (final target)
hackathon-2026/
├── README.md                          # Punchline opener + setup + context
├── DECISIONS.md                       # Every assumption documented
├── PROJECT_PLAN.md                    # Phase tracker
├── RUBRIC_CHECKLIST.md                # Maps every rubric item to deliverable
├── QUESTIONS.md                       # Running parking lot
├── requirements.txt                   # Reproducibility
├── run_pipeline.py                    # AUTOMATION: regenerates everything
├── presentation.pdf                   # 9 slides, 6-min talk
├── database.db                        # Working SQLite DB
├── .gitignore
│
├── schema/
│   ├── create_tables.sql              # PKs, FKs, types, NOT NULL
│   ├── er_diagram.png                 # Visual schema
│   └── data_dictionary.md             # Column-by-column reference
│
├── sql/
│   ├── q01_state_overview.sql
│   ├── q02_burden_ranking.sql         # Window functions
│   ├── q03_capacity_ranking.sql       # Window functions
│   ├── q04_vulnerability_layer.sql    # JOINs, CASE
│   ├── q05_equity_gap_index.sql       # CTEs (headline)
│   ├── q06_top_underserved.sql        # Subqueries
│   ├── q07_regional_patterns.sql      # Delta vs non-Delta
│   └── q08_drivers_analysis.sql       # Per-county driver breakdown
│
├── python/
│   ├── 01_load_data.py                # Raw → SQLite
│   ├── 01b_data_quality_checks.py     # CLEANING WORKFLOW (visible)
│   ├── 02_visualize.py                # SQLite → charts
│   ├── 03_statistical_analysis.py     # STATS BONUS: correlation, regression, CIs
│   └── utils.py
│
├── notebooks/
│   └── analysis_walkthrough.ipynb     # End-to-end story
│
├── visualizations/
│   ├── mississippi_equity_gap_map.html   # INTERACTIVE BONUS
│   ├── mississippi_equity_gap_map.png    # Static fallback for slides
│   ├── top10_underserved.png
│   ├── drivers_grid.png
│   ├── burden_vs_capacity_scatter.png
│   ├── correlation_heatmap.png           # From stats analysis
│   └── full_ranking.csv
│
├── docs/
│   ├── data_cleaning_report.md           # CLEANING BONUS
│   └── context_and_background.md         # RESEARCH BONUS (with citations)
│
└── data/
├── raw/                              # Original downloads (.gitignored if large)
└── processed/                        # Cleaned outputs

## Datasets (LOCKED IN)
All three from the recommended dataset list in the instructions:
1. **CDC PLACES** — county-level chronic disease prevalence → `data/raw/places_county.csv`
2. **CDC/ATSDR SVI** — county-level social vulnerability → `data/raw/svi_county.csv`
3. **HRSA Area Health Resources File (or CMS provider data + Census ACS)** — provider counts and population for capacity calculation → `data/raw/providers.csv` + `data/raw/census_population.csv`

All datasets joined on **5-digit County FIPS** (Mississippi state FIPS = 28, 82 counties expected: 28001–28163 with gaps).

## How I want Claude Code to work with me
- **Phase-by-phase.** Confirm what phase we're in before starting work. Never jump ahead.
- **Outline before building.** For schema, queries, and visualizations, propose the plan first and wait for my approval.
- **Document as we go.** Every SQL file gets a header comment. Every Python script gets a module docstring. DECISIONS.md gets updated immediately when a judgment call is made.
- **Mississippi-only filter.** All data filtered to state FIPS = 28. No national-scale loads.
- **No new dependencies without approval.**
- **End each phase clean.** Code runs, files committed to git, PROJECT_PLAN.md and RUBRIC_CHECKLIST.md updated.
- **Teach me the code.** Before finalizing any SQL or Python, walk me through it line-by-line as if quizzing me. I must be able to defend every line in the presentation.

## What the judges score on (must hit ALL FIVE rubric categories at maximum)
1. **Data Understanding & Schema Design** — normalized schema with PKs, FKs, constraints, ER diagram, data dictionary
2. **Querying & Analysis** — 8 commented SQL files, CTEs, window functions, joins, aggregations
3. **Insight Generation** — composite EGI, top-10 ranking, per-county driver breakdown, regional comparison
4. **Visualization** — 6+ visuals including interactive choropleth, headline finding visible at a glance
5. **Communication** — README opens with punchline, 9-slide deck for 6-min talk, dual-audience clarity
6. **Creativity & Initiative** — Original composite index, novel framing, "tool for the Gulf South Center" angle

## Bonus considerations targeted (must hit ALL SIX)
1. **Advanced SQL techniques** — CTEs in q05, window functions (RANK, NTILE, PERCENT_RANK) across q02/q03/q06
2. **Data cleaning workflows** — `01b_data_quality_checks.py` runs validation suite; `docs/data_cleaning_report.md` documents every cleaning decision
3. **Statistical analysis** — `03_statistical_analysis.py` runs Pearson correlations, OLS regression, bootstrap confidence intervals, outlier detection
4. **Automation** — `run_pipeline.py` regenerates the entire project (raw → DB → queries → stats → visuals → exports) in a single command
5. **Interactive visualizations** — Plotly choropleth saved as standalone HTML with hover tooltips
6. **Additional research / contextual analysis** — `docs/context_and_background.md` with 3–5 cited sources (CDC, RWJF County Health Rankings, MS State Dept of Health, peer-reviewed literature)

## Submission checklist (must hit ALL)
- [ ] ZIP named `LastName_FirstName_Round1.zip`
- [ ] Email subject `Hackathon2026_Round1_LastName_FirstName`
- [ ] Email sent to corey.welborn@usm.edu by 6:00 PM Sunday May 17, 2026
- [ ] README contains: project overview, datasets used, key findings, setup instructions
- [ ] Presentation contains: project focus, datasets, schema/approach, methods, viz, findings, conclusions
- [ ] No `venv/`, `node_modules/`, `__pycache__/`, `dist/`, `build/`, or cache folders in ZIP
- [ ] If ZIP > 25 MB: cloud link instead of attachment

## What we are NOT building
- A web dashboard (that's Round 2)
- A production system
- A national-scale analysis
- Anything requiring Postgres, Docker, or external services
- Any AI/ML beyond simple OLS regression
- A custom data pipeline framework — keep it simple Python scripts

## Working principles
- SQLite over Postgres (ships in the ZIP, no setup for judges)
- One question per SQL file (so judges can audit)
- All decisions defensible (I have to explain them on Monday)
- "Tool the Gulf South Center could actually use" is the through-line of the pitch