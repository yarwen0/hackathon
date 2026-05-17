# Presentation Talking Points

> Verbatim-usable lines and short stories collected during the build for the
> Phase 6 deck. Each entry is short enough to deliver as spoken text. Use
> these as the seed of slide narration, Q&A answers, and the README hook.

## Phase 6 — Presentation hooks

### Headline finding — Issaquena County (the marquee result)

> **Issaquena County** — population 1,206, on the Mississippi River in the
> Delta — has the largest health equity gap in Mississippi under our
> Equity Gap Index. Its residents face an uninsured rate of 20.0 % (state
> county-mean 13.2 %), high blood pressure prevalence of 48.9 % (state
> county-mean 43.5 %), and diabetes prevalence of 17.8 % (state county-mean
> 14.8 %); they have **zero** county-attributed primary-care providers
> against a typical Mississippi county's 15.5 per 10,000 residents; and they
> live in the 9th-most-vulnerable county of 82 statewide for overall social
> vulnerability — and the **single most vulnerable county in Mississippi**
> for housing and transportation barriers (SVI Theme 4 = 1.00). **This is
> the county our index identifies as most underserved — and Issaquena is
> already a federally-designated Health Professional Shortage Area,
> providing independent validation of the methodology.**

Every number above is verified directly against `database.db` (see
`sql/q05_equity_gap_index.sql` plus the Issaquena-specific verification
queries used during Phase 3 Step D). Use this for: the opening slide hook,
the README opener, and the README "key findings" section.

### Statistical validation findings (Phase 3.5)

Use these in the Methods / Results / Limitations slides and in the README's
"Statistical validation" section. Every number traceable to
`python/03_statistical_analysis.py` outputs.

**Component correlation (Pearson, 82 counties).** Burden and vulnerability
components correlate at **r = 0.734** — above the 0.7 partial-double-counting
threshold. Reflects real co-occurrence of disease burden and social
vulnerability in poor MS counties, not a methodology flaw. Capacity is more
weakly correlated with both. Future work: PCA-derived orthogonal weights.

**OLS regression** (egi_score ~ pcp_per_10k + rpl_themes + is_rural + is_delta).
**R² = 0.978** — model explains essentially all of the EGI variance. Three
predictors significant at p<0.05: provider density (−0.70 EGI per +1
provider/10k), SVI percentile (+4.23 EGI per +0.10 RPL), rural flag (+4.48
EGI). `is_delta` NOT significant (p=0.814) once the others are controlled —
the entire "Delta effect" is mediated by Delta counties being rural,
vulnerable, and thinly-staffed.

> **Q&A defense:** "Is your index just measuring 'Delta'?" → "No. After
> controlling for the underlying components, being in the Delta adds no
> independent signal — the Delta's high EGI is fully explained by its
> rural-vulnerable-low-capacity profile, which is exactly what a well-built
> composite should produce."

**Bootstrap CI (1,000 iterations, top-10 counties).** Max CI width = 13.31
EGI points. Issaquena #1 (CI 81.18–92.26) overlaps with Holmes #2 (CI
77.14–90.46) — all 9 adjacent top-10 pairs have overlapping CIs.

> **Honest framing for the headline:** "Issaquena's #1 ranking is the
> best-supported point estimate. Bootstrap analysis shows the top 5
> counties are a statistically clustered group of rural Delta counties whose
> underservedness is materially indistinguishable at 95% confidence. We
> claim Issaquena is the highest-EGI county under our index, and one of a
> tight cluster of 5 Delta counties at the top of the distribution."

**Outliers (z > 2 on egi_score).** 4 outliers, all on the LOW side: Lee
(Tupelo), Rankin and Madison (suburban Jackson), Lamar (Hattiesburg metro).
Zero HIGH-side outliers — Issaquena's z ≈ +1.98 just below the threshold.

> **Implication for policy:** "Underservedness in Mississippi isn't
> concentrated in a few anomalous counties — the top-10 form a continuous
> shoulder of the distribution. State-level intervention can't be limited
> to '2 or 3 worst-case counties' because there are no such isolated
> cases — there is a broad band of underserved rural counties needing
> attention."

### D-010 amendment — "iterative validation" story (20 seconds)

> "During analysis we noticed our initial ZIP-to-county attribution rule had
> produced zero providers for 20% of Mississippi counties. We traced one
> example to Clay County losing its own county-seat ZIP (West Point) to a
> larger neighbor purely on population. We switched to area-weighted
> attribution — the more direct geographic measure — and the zero-provider
> count dropped from 16 to 1, where that 1 (Issaquena) is a federally
> designated shortage area where zero is real. This kind of iterative
> validation is why the resulting index is credible."

Use this for: the "methods rigor" slide, the Q&A about confidence in the
provider counts, or anywhere a judge asks "how do you know your numbers are
right?"
