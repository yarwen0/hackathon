# Demo Cheat Card — EGI Workbench

> Print this and bring it Monday. 5-minute Sarah Chen arc + the Q&A
> answers that have lost previous hackathons.

## Before you walk in

- [ ] Laptop charged + screen brightness all the way up
- [ ] Backup screenshots on phone (just in case)
- [ ] Connected to a network · then load every surface once to warm caches
- [ ] Signed in as **officer@gulfsouth.example / demo**
- [ ] Browser zoomed to a comfortable read-from-the-back level
- [ ] Have `https://<your-vercel-url>.vercel.app` and the GitHub URL bookmarked

## The 5-minute arc

### 30 s — Hook
> "Round 1 produced a Mississippi Health Equity Gap Index. Issaquena
> County ranked #1 — most underserved. The federal HPSA designation
> independently corroborated that finding. **But ranking alone doesn't
> solve a problem. The Gulf South Center has to decide where to invest.**
> So we built them a tool."

### 60 s — Persona + landing + drilldown
> "Sarah Chen, program officer. Tuesday meeting with a foundation
> considering a $2M rural-health investment."

Click: `/login` → officer button → landing.

> "She filters to Delta + rural" *(click those filter chips)* "Map and
> table re-sort live, URL updates so she can share this exact view."

Click an Issaquena row → county page.

> "Drilling into Issaquena — every number has the ℹ icon. Click any of
> them and you see source, decision rationale, SQL snippet that produced
> it. Zero providers, 100th percentile capacity scarcity."

### 60 s — Compare + cohort
> "But Issaquena has 1,206 people. Holmes has 17,000 and is *more*
> vulnerable."

Click "Compare to another county" → pick Holmes.

> "She decides a multi-county cohort is the right grant target."

Click "Build cohort from this county" → arrive at /cohort with Delta+rural
seeded. Tighten filter: EGI ≥ 75.

> "She lands at a 7-county cohort, 95 k people, median EGI 82. **Save &
> share** copies a link her teammates can open. **PDF report** —"

Click PDF report.

> "— a foundation-ready document with methodology citations, county
> table, and the source SQL in the appendix."

### 45 s — Reweight Lab
Click /reweight.

> "Before the meeting Sarah has to know whether her recommendation is
> robust. She drags the vulnerability slider to 60%."

Drag the slider.

> "Headline indicator updates. She can now tell the foundation:
> *'Issaquena is #1 under most weightings; if your priority is
> specifically vulnerability, here's how the top shifts.'* That nuance
> wins grants."

### 45 s — Ask the EGI
Click /ask → click the "Delta counties: low burden + high vulnerability" chip.

> "Some questions don't fit any of these views. The SQL is shown — *that's
> the transparency mechanism*. The results table. The plain-English
> answer. She can verify what the AI asked the database before she trusts
> the answer."

### 30 s — Methodology + close
Click /methodology → scroll to the 3-column ranking comparison.

> "Every score, every methodology, every data source — documented.
> Three weighting schemes side-by-side: equal thirds, data-driven PCA,
> burden-weighted. Six counties appear in every top-10 list — the robust
> core of the index. Round 1 produced the index. Round 2 produced the
> tool. **We'd like to put this in front of the Center.**"

## Q&A — the answers that win

**Why SQLite for a real product?**
> 82 counties × 9 tables × 12k rows. SQLite is the right tool for
> read-heavy, ships-with-the-app static data. Used by Bloomberg, Apple,
> Mozilla, every iPhone. We open it `readonly: true` — even AI-generated
> queries can't mutate it.

**Why not Postgres?**
> Postgres adds network latency, connection pools, and a deploy
> dependency for zero benefit at 82 rows. If we grew to national scope,
> swapping the connection layer in `lib/db.ts` for `pg` is a 2-hour
> migration because every query is plain SQL.

**How is the AI page safe from destructive queries?**
> Three layers. (1) LLM system prompt restricts to SELECT-only on a
> whitelisted table set. (2) Server-side regex validation rejects any
> non-SELECT, multi-statement, commented, or forbidden-keyword query
> before execution. (3) The database connection itself is opened with
> `readonly: true`. Even a query that bypassed our validators couldn't
> write.

**Why three roles?**
> One doesn't model the Center's structure; five would be invented.
> Three (officer / steward / collaborator) maps to people who actually
> do this work. Adding a fourth is one constant in
> `src/lib/demo-users.ts`.

**Scale to other states?**
> The ingestion pipeline is FIPS-keyed throughout. Re-run
> `python/01_load_data.py` with `state_fips = '01'` for Alabama; the
> frontend works unchanged because every route reads from a view. State
> selector in the nav is 2 hours. Total: under a day per state.

**Time-series support?**
> Add `snapshot_year` column. Parameterize the view. Swap headline cards
> for sparklines. About a day. We didn't build it because we have one
> vintage and faking a time series would be dishonest.

**Real-time data?**
> Wrong primitive for annual federal data. We focused on real-time
> *responsiveness* — every filter, slider, cohort update is sub-200ms.
> WebSocket subscriptions would be unused infrastructure for federal
> datasets.

**What would you build next?**
> A "cohort intervention simulator" — pick a cohort, add hypothetical
> providers, see how rankings shift. The underlying math (how much one
> new NP shifts capacity) needs literature review we couldn't compress
> into the weekend. API contract is sketched in `src/lib/types.ts`.

## If something breaks

- **Map won't load** → reload page; the GeoJSON is local
- **Groq returns 429** → use the chips, they don't hit Groq
- **PDF takes > 5 s** → loading state shown; wait it out
- **No wifi** → `npm run dev` works fully offline; database is bundled

## The close

> "We'd like to put this in front of the Center."

This is the line that separates *built a project* from *built something
the audience could ship*. Don't skip it.
