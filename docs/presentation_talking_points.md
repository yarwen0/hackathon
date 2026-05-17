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
