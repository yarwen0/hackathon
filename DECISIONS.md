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

### D-003. Data vintages locked

**Decision:** The following dataset releases will be used and no others:

| Dataset      | Release / vintage              | Reference year(s) covered |
|--------------|--------------------------------|---------------------------|
| CDC PLACES   | 2024 release                   | 2022 BRFSS estimates      |
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

_(to be filled in)_

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
