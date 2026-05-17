# Mississippi Health Equity Gap Index — Presentation Script

> 9 slides for a 6-minute virtual presentation to the Gulf South Center.
> Per-slide structure: **Title** / **Body** (visual content for the slide) /
> **Speaker notes** (verbatim script, ~30–60 seconds each, total target 5:40).
>
> Total wall time target: 5:30–5:50.
> Paste each slide's Body into Keynote / PowerPoint; deliver the Speaker notes
> verbatim. Embedded image files are in `visualizations/` and `schema/`.
>
> **Delivery convention:** *[beat]* in speaker notes indicates a deliberate
> 1–2 second pause — these are dramatic-emphasis moments and rushing them
> undercuts the argument.

---

## Slide 1 — Title  (~12s)

**Title (slide header):**
Mississippi Health Equity Gap Index

**Body (slide layout):**
- Subtitle: "A county-level composite combining health burden, provider capacity, and social vulnerability"
- Author: *[your name]*
- Date: 2026-05-18

**Speaker notes:**
Good afternoon. I'm *[your name]*. I built the Mississippi Health Equity Gap Index — a county-level composite that ranks all 82 Mississippi counties by underservedness, combining three federally-sourced inputs. Let me show you the headline finding.

---

## Slide 2 — The headline  (~46s)  *[ultrathink: build-and-reveal hook]*

**Title:**
The most underserved county in Mississippi

**Body (compact fact table):**

| Issaquena County, Mississippi | |
|---|---|
| Population | 1,206 |
| EGI rank | **#1 of 82** |
| Primary-care providers per 10k | **0.0** (state county-mean: 15.5) |
| Uninsured rate | 20.0% (state county-mean: 13.2%) |
| SVI Theme 4 (housing & transport) | **1.00** — most vulnerable in MS |
| Federal status | **Designated Health Professional Shortage Area** |

**Speaker notes:**
The most underserved county in Mississippi under our index is Issaquena — population 1,206, in the Delta along the Mississippi River. Zero attributed primary-care providers against a state county-mean of about fifteen per ten thousand. Twenty percent uninsured. The single most vulnerable Mississippi county for housing and transportation access. And here's the thing: Issaquena is already a federally-designated Health Professional Shortage Area. *[beat]* We didn't reverse-engineer that. *[beat]* We combined three independent federal datasets and the index landed on the same county the federal government had separately identified. Three datasets, one composite, one answer. That convergence is the strongest validation a methodology can have.

---

## Slide 3 — Why this matters  (~35s)

**Title:**
Mississippi at the bottom of every U.S. ranking

**Body (3 bullets + one statistic):**
- America's Health Rankings: **MS #49 or #50** almost every year of the modern series
- Within MS, the **Delta region** (18 counties along the Mississippi River, federally designated by the Delta Regional Authority) concentrates compounded health and economic disparity
- High obesity, high diabetes, low provider density, structural disadvantage layered on geographic isolation

**Speaker notes:**
Mississippi has ranked at the bottom of America's Health Rankings — number 49 or 50 — almost every year for over a decade. Within the state, the Delta region — 18 counties along the Mississippi River, formally designated by the federal Delta Regional Authority — concentrates compounded disadvantage: high obesity, high diabetes, low provider density, structural poverty, geographic isolation. The Gulf South Center exists to address exactly this. The hard question is *where to start*. Which counties do you prioritize? That's what this index answers.

---

## Slide 4 — The data foundation  (~35s)

**Title:**
Five federal datasets, nine tables

**Body (embed ER diagram + compact datasets list):**

![Schema ER diagram](../schema/er_diagram.png)

Sources: **CDC PLACES** (chronic disease) · **CDC/ATSDR SVI** (vulnerability) · **CMS NPPES** (providers) · **Census ACS** (population) · **Census ZCTA crosswalk**

**Speaker notes:**
The index sits on top of three federally-maintained data programs plus two supporting datasets. CDC PLACES for chronic disease burden — 40 county-level prevalence measures from BRFSS. The CDC/ATSDR Social Vulnerability Index for structural disadvantage — overall percentile plus four theme-level rankings. CMS NPPES for provider counts — filtered to the six primary-care taxonomies HRSA uses for shortage-area designation. Census ACS for population, ZCTA-county crosswalk for ZIP-to-county attribution. Nine relational tables, 27 data-quality checks, all loaded in under a second by a single Python script. Every dataset's URL, vintage, and retrieval date is logged.

---

## Slide 5 — How the index works  (~40s)

**Title:**
Equal-weighted three-component composite

**Body (the formula + one-line defense):**

```
EGI = (1/3) × Burden component
    + (1/3) × Capacity component
    + (1/3) × Vulnerability component
```

Each component min-max normalized 0–100 across 82 MS counties. Equal weights follow the **County Health Rankings** convention; defended in `DECISIONS.md` D-016 against three alternatives.

**Speaker notes:**
The Equity Gap Index is one-third burden plus one-third capacity plus one-third vulnerability, where each component is normalized to a zero-to-100 scale across Mississippi counties. Burden is a polarity-aware average of 10 PLACES measures. Capacity is primary-care providers per ten thousand residents, inverted. Vulnerability is the SVI intra-state percentile. Equal weights follow the County Health Rankings convention — we considered three alternative weighting schemes and rejected each. Without a formal stakeholder-elicitation process, equal weights are the most defensible choice. The full math lives in one SQL file.

---

## Slide 6 — The map  (~30s)

**Title:**
Underservedness across Mississippi

**Body (full-slide image):**

![Mississippi EGI choropleth](../visualizations/mississippi_egi_map.png)

**Speaker notes:**
This is the map. Every Mississippi county shaded by EGI score: green to red, higher equals more underserved. The Delta cluster in the northwest is unmistakable. The top 10 most underserved counties are outlined in black — 8 are in the Delta, 2 are rural Other-region counties (Noxubee and Kemper). The map shows the geographic pattern; the next slide breaks down what's driving each top county.

---

## Slide 7 — Top 10 + what drives each one  (~40s)

**Title:**
Top 10 most underserved counties

**Body (full-slide image):**

![Top 10 EGI counties](../visualizations/top10_bar.png)

**Speaker notes:**
The top 10 counties, EGI scores ranging from 73 to 87. Each bar shows the three component contributions to the composite. Issaquena tops the chart not because of one extreme — it's high on all three pillars simultaneously. Query q06 in the project confirms this: 8 of 10 top counties are what we call "multi-component dominant" — meaning all three pillars are elevated, not just one. Across the top 10, two PLACES measures stand out — obesity and high blood pressure are the top burden drivers in nearly every top-EGI county. Query q08 identifies the specific drivers per county for stakeholder use.

---

## Slide 8 — What's in it for the Gulf South Center  (~55s)

**Title:**
What's in it for the Gulf South Center

**Footer tag:** Use case

**Body (4 cards in 2×2 grid):**

| Card 1 — Decision-ready ranking | Card 2 — Reproducible by design |
|---|---|
| All 82 counties ranked, with each component visible per county. A steering committee can open one CSV and see priority order plus the reason for the priority. | The full pipeline regenerates from raw federal data in a single command. As PLACES, SVI, and HRSA update annually, the index updates with them. |

| Card 3 — Traceable methodology | Card 4 — Extensible foundation |
|---|---|
| Every analytical decision logged with rationale. When the Center allocates resources, the receipts are right there — three federal datasets, transparent math, no black box. | The codebase is a starting point. Add specialty-care taxonomies, swap rural classification for USDA RUCC, extend to AL/LA/AR — the federal inputs are the same. |

**Closing box:**
"Three concrete next steps would make this a working tool: stakeholder-elicited weights to replace the equal-thirds default, a multi-year time series to surface trends, and sub-county breakdowns by age and race where the underlying data supports it. That's the work I'd want to do at the Center."

**Speaker notes:**
Four concrete things this index gives the Gulf South Center.

First — decision-ready ranking. All 82 counties, each with the three component scores visible. Open one CSV, see priority order plus the reason for that priority.

Second — reproducible by design. The full pipeline regenerates from raw federal data in a single command. As PLACES, SVI, and HRSA update annually, the index updates with them — no rebuild needed.

Third — traceable methodology. Every analytical decision logged with rationale. When the Center allocates resources, the receipts are right there — three federal datasets, transparent math, no black box.

Fourth — extensible foundation. Add specialty-care taxonomies, swap rural classification for USDA RUCC, extend to Alabama, Louisiana, Arkansas. The codebase is a starting point, not a black box.

Three concrete next steps would make this a working tool: stakeholder-elicited weights to replace the equal-thirds default, a multi-year time series to surface trends, and sub-county breakdowns by age and race where the underlying data supports it. That's the work I'd want to do at the Gulf South Center.

---

## Slide 9 — Limitations and questions  (~48s)

**Title:**
Limitations — and an honest validation story

**Body (4 bullets):**

- **Burden ↔ vulnerability r = 0.734** (partial double-counting). Capacity ↔ vulnerability r = 0.064 (genuinely independent — strength)
- **No population floor** — Issaquena (pop 1,206) ranks #1; federal HPSA convergence makes this validation, not concern
- **Iterative validation** — initial ZIP→county rule produced zero providers for 20% of counties; caught mid-analysis, fixed via area-weighted attribution; zero-count dropped from 16 to 1
- **Bootstrap 95% CIs** show top-5 counties statistically clustered — Issaquena #1 best-supported, not uniquely separated

**Speaker notes:**
Four limitations worth flagging. One: burden and vulnerability correlate at r equals 0.73 — partial double-counting; both pick up structural disadvantage. Capacity is genuinely independent at r equals 0.06, which is a methodology strength. Two: no population floor — Issaquena ranks number one despite 1,206 residents; the federal HPSA convergence makes this validation, not concern. Three: the iterative-validation story. Our initial ZIP-to-county attribution rule produced zero providers for 20 percent of counties. We caught it mid-analysis, traced Clay County losing its county-seat ZIP to Monroe purely on population, switched to area-weighted attribution, and dropped the zero count from 16 to 1. That kind of iterative checking is why the numbers are credible. Happy to take questions.

---

## Timing summary

| # | Slide | Target | Cumulative |
|---|---|---:|---:|
| 1 | Title | 12s | 0:12 |
| 2 | Headline (Issaquena) | 46s | 0:58 |
| 3 | Mississippi context | 35s | 1:33 |
| 4 | Data foundation | 35s | 2:08 |
| 5 | Methodology | 40s | 2:48 |
| 6 | Map | 30s | 3:18 |
| 7 | Top 10 + drivers | 40s | 3:58 |
| 8 | Use case for the Center | 50s | 4:48 |
| 9 | Limitations + Q&A | 48s | **5:36** |

Lands at 5:36 — inside the 5:30–5:50 window with margin to slow down on slide 2 or stretch slide 8 if needed.
