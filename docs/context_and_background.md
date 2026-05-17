# Context and Background

> Mississippi has the worst overall health outcomes of any U.S. state by most
> standard rankings. This document situates the Mississippi Health Equity Gap
> Index against the broader research and policy landscape: where the project's
> methodology comes from, which federal programs publish the inputs we use,
> and how our index is meant to complement (not replace) the federally-
> maintained underservedness designations that already exist.

## Mississippi's state-level health context

Mississippi has consistently ranked at or near the bottom of every major U.S.
state health ranking for more than a decade. **America's Health Rankings**, the
annual UnitedHealth Foundation report that's the longest-running comparative
state health ranking in the country, has placed Mississippi at #49 or #50
overall almost every year of its modern series. The drivers are familiar: high
obesity, high diabetes, high cardiovascular mortality, high uninsured rates,
high rates of chronic stress and poverty, and large rural areas with limited
access to medical care.

Within Mississippi, the **Mississippi Delta** — the alluvial plain along the
Mississippi River in the northwestern part of the state — has long been
recognized as a distinct, federally-significant region of concentrated
economic disadvantage and chronic health disparity. The **Mississippi Delta
Regional Authority (DRA)**, a federal regional commission established by
Congress, formally designates **18 Mississippi counties** as comprising the
Mississippi portion of the Delta region for federal investment and
coordination purposes. The Phase 3 / `q07` regional comparison in this project
uses that same 18-county DRA designation (see `DECISIONS.md` D-013), and the
Delta-vs-non-Delta gap we measure (16 EGI points, with 8 of the top-10 most
underserved counties Delta-resident) is consistent with decades of public
health literature on Delta region disparities.

## The three federal data programs this project sits on top of

This project is a **composite layered on top of three pre-existing federal
data programs**. Each program is itself the product of substantial
infrastructure investment by federal agencies; we are recombining them, not
producing new health statistics.

### CDC PLACES — chronic disease burden

The **CDC PLACES** program (formerly "500 Cities Project," extended to all
U.S. counties in 2020) publishes model-based small-area estimates of 40
chronic disease, behavior, prevention, and disability measures at the county,
ZCTA, census-tract, and place level. The underlying data source is the
**Behavioral Risk Factor Surveillance System (BRFSS)**, the largest ongoing
state-level telephone health survey in the U.S. PLACES uses validated
multilevel small-area estimation to produce stable county-level prevalence
estimates even where the BRFSS sample for a single county is small. This
project uses PLACES' MS county estimates for the EGI's burden component.

- CDC PLACES program: <https://www.cdc.gov/places/index.html>
- CDC BRFSS (the underlying survey): <https://www.cdc.gov/brfss/index.html>

### CDC/ATSDR Social Vulnerability Index — structural disadvantage

The **Social Vulnerability Index (SVI)**, maintained by CDC's Agency for Toxic
Substances and Disease Registry (ATSDR) and originally developed for emergency
response and disaster preparedness, ranks every U.S. census tract and county
on social, economic, and household factors that affect a community's ability
to prepare for, respond to, and recover from external stressors. SVI is
released as an overall percentile rank (`RPL_THEMES`) plus four theme-level
sub-rankings (socioeconomic status; household characteristics; racial &
ethnic minority status; housing type & transportation). Because SVI's
underlying estimate inputs come from the American Community Survey, the
2022 SVI release is built on 2018–2022 ACS data.

This project uses the **Mississippi-state-only SVI file** so that all RPL
rankings are computed as intra-state percentiles — a county's RPL of 0.80
means more vulnerable than 80 % of *other Mississippi counties*, which is
the right reference frame for a state-level equity index (DECISIONS.md
D-007).

- CDC/ATSDR SVI: <https://www.atsdr.cdc.gov/place-health/php/svi/index.html>

### CMS NPPES + HRSA shortage-area framework — provider capacity

Provider capacity in this project is sourced from the **CMS National Plan and
Provider Enumeration System (NPPES)** monthly snapshot, filtered to the
six **HRSA-aligned primary-care taxonomies** that the Health Resources and
Services Administration uses to define primary care for its **Health
Professional Shortage Area (HPSA)** designation program: Family Medicine,
Internal Medicine, Pediatrics, OB/GYN, Nurse Practitioners, and Physician
Assistants. HRSA's HPSA program independently designates U.S. geographic
areas, population groups, and facilities that have insufficient primary
medical, dental, or mental health care. Issaquena County, Mississippi — the
#1 most-underserved county in our Equity Gap Index — is an example of an
HRSA-designated primary-care HPSA, providing independent federal
cross-validation of our index ranking.

- HRSA Health Professional Shortage Areas: <https://data.hrsa.gov/topics/health-workforce/shortage-areas>
- CMS NPPES Data Dissemination: <https://download.cms.gov/nppes/NPI_Files.html>

## Methodological precedent: County Health Rankings

The most prominent county-level composite health index in the United States
is the **County Health Rankings & Roadmaps** program, a Robert Wood Johnson
Foundation initiative produced annually in collaboration with the University
of Wisconsin Population Health Institute. County Health Rankings publishes
state-by-state rankings of every U.S. county on a set of weighted
health-outcome and health-factor measures. Two methodological choices in
that program are worth noting here:

1. **Equal-weighted aggregation within thematic groups** — County Health
   Rankings uses simple equal weights when aggregating measures into
   sub-categories. We follow the same convention for the three EGI
   components (DECISIONS.md D-016: equal thirds), with the same defense:
   in the absence of a formal stakeholder-elicitation process and a
   theoretical reason to favor one component, equal weights are the most
   transparent and defensible choice.
2. **Outcomes vs factors separation** — County Health Rankings explicitly
   distinguishes health *outcomes* from the health *factors* that drive
   them. The EGI in this project is a slightly different framing — it asks
   "where is the equity gap largest?" rather than "which county is
   healthiest?" — but the multi-factor composite framing comes directly
   from this tradition.

Mississippi's per-county rankings within the County Health Rankings program
are widely cited by state policymakers; Mississippi as a whole consistently
ranks among the worst-performing states.

- County Health Rankings & Roadmaps: <https://www.countyhealthrankings.org/>

## What this project adds

Three federally-maintained programs already publish the inputs we use
(PLACES, SVI, HRSA), and County Health Rankings already publishes a
composite within each state. **What this project adds is a Mississippi-
specific, intra-state composite that combines all three of those federal
inputs into a single 0–100 underservedness score per county, with full
methodological transparency, full reproducibility from a single command,
and an explicit cross-validation against HRSA's HPSA designation list.**

The project is intentionally scoped as a decision-support tool for the
**Gulf South Center for Community-Engaged Health Research and Innovation**:
a state-level institution whose stakeholders need a single, defensible,
plain-English ranking of which Mississippi counties to prioritize, with
the ability to drill into "why is this county high?" (burden? capacity?
vulnerability? all three?) for each individual county.

Two operational features make the EGI useful as a decision-support tool:

1. **Component transparency** (DECISIONS.md D-018). Every row of the
   `v_equity_gap_index` SQL view exposes the three component scores
   alongside the composite EGI, so a stakeholder can immediately see
   whether a top-10 county's underservedness is driven by burden,
   capacity, vulnerability, or all three. The Phase 3 q08 driver-analysis
   query goes further, identifying the specific PLACES burden measures
   that most exceed state average for each top-10 county.
2. **Reproducibility** (D-005 + `run_pipeline.py`). The full pipeline
   — from raw federal downloads to the EGI view to the visualization
   artifacts — runs in a single command. If a future stakeholder wants to
   change the weighting, swap one component for another, or extend the
   index to additional Gulf South states, the codebase is a starting
   point, not a black box.

## Mississippi-specific organizations referenced in this project

- **Mississippi Delta Regional Authority (DRA)** — federal regional
  commission; defines the official 18-county Mississippi Delta region used
  in D-013 and q07. <https://msdelta.gov/>
- **Mississippi State Department of Health** — state public health agency.
  <https://msdh.ms.gov/>
- **Pine Belt Mental Healthcare Resources** — the source of our 8-county
  Pine Belt regional definition in D-013.

## Sources cited

1. CDC PLACES — Local Data for Better Health.
   <https://www.cdc.gov/places/index.html>
2. CDC/ATSDR Social Vulnerability Index.
   <https://www.atsdr.cdc.gov/place-health/php/svi/index.html>
3. CDC Behavioral Risk Factor Surveillance System (BRFSS).
   <https://www.cdc.gov/brfss/index.html>
4. HRSA Health Workforce — Shortage Areas (HPSA / MUA / MUP).
   <https://data.hrsa.gov/topics/health-workforce/shortage-areas>
5. CMS National Plan and Provider Enumeration System (NPPES) Data Dissemination.
   <https://download.cms.gov/nppes/NPI_Files.html>
6. Robert Wood Johnson Foundation & University of Wisconsin Population
   Health Institute — County Health Rankings & Roadmaps.
   <https://www.countyhealthrankings.org/>
7. UnitedHealth Foundation — America's Health Rankings annual report.
   <https://www.americashealthrankings.org/>
8. Mississippi Delta Regional Authority.
   <https://msdelta.gov/>
9. Mississippi State Department of Health.
   <https://msdh.ms.gov/>
