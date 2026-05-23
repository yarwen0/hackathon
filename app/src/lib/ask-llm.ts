// "Ask the EGI" — natural-language → SQL → results → plain-English summary.
// Defense-in-depth:
//   1. The LLM system prompt restricts output to SELECT-only on whitelisted tables.
//   2. Server-side regex validation rejects multi-statement, comments, forbidden keywords.
//   3. The DB handle itself is opened with readonly: true — even a query that bypassed
//      our validators couldn't write.

import Groq from 'groq-sdk';
import { db } from './db';
import type { AskResponse, StarterChip } from './types';

const MODEL = 'llama-3.3-70b-versatile';

// 5 hand-written chips with pre-baked SQL. Work even if Groq is down.
export const STARTER_CHIPS: StarterChip[] = [
  {
    id: 'capacity_scarcity',
    label: 'Top 5 counties by capacity scarcity',
    question: 'Which counties have the worst primary-care capacity?',
    sql: `SELECT v.county_name, v.region, v.capacity_component AS capacity_scarcity,
       ROUND(1.0 * COALESCE(SUM(pc.provider_count), 0) * 10000.0 / c.population, 2) AS pcp_per_10k
FROM v_equity_gap_index v
JOIN counties c ON c.fips = v.fips
LEFT JOIN provider_capacity pc ON pc.fips = v.fips
GROUP BY v.fips, v.county_name, v.region, v.capacity_component, c.population
ORDER BY v.capacity_component DESC
LIMIT 5`,
  },
  {
    id: 'delta_low_burden_high_vuln',
    label: 'Delta counties: low burden + high vulnerability',
    question:
      'Which Delta counties have below-state-mean burden but above-state-mean vulnerability?',
    sql: `WITH means AS (SELECT AVG(burden_component) AS mb, AVG(vulnerability_component) AS mv FROM v_equity_gap_index)
SELECT county_name, burden_component, vulnerability_component, egi_score, egi_rank
FROM v_equity_gap_index, means
WHERE region = 'Delta'
  AND burden_component < mb
  AND vulnerability_component > mv
ORDER BY (vulnerability_component - burden_component) DESC`,
  },
  {
    id: 'diabetes_top5',
    label: 'Top 5 counties by diabetes prevalence',
    question: 'Which counties have the highest diabetes prevalence?',
    sql: `WITH latest AS (SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id)
SELECT c.county_name, c.region, hi.data_value AS diabetes_pct, hi.year
FROM health_indicators hi
JOIN counties c USING (fips)
JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
WHERE hi.measure_id = 'DIABETES'
  AND hi.data_value_type = 'Age-adjusted prevalence'
ORDER BY hi.data_value DESC
LIMIT 5`,
  },
  {
    id: 'rural_delta_egi',
    label: 'Rural Delta counties ranked by EGI',
    question: 'Show me all rural Delta counties ranked by EGI.',
    sql: `SELECT v.county_name, c.population, v.burden_component, v.capacity_component, v.vulnerability_component, v.egi_score, v.egi_rank
FROM v_equity_gap_index v
JOIN counties c USING (fips)
WHERE v.region = 'Delta' AND c.is_rural = 1
ORDER BY v.egi_rank ASC`,
  },
  {
    id: 'svi_theme4_dominant',
    label: 'Counties where housing/transport drives vulnerability',
    question:
      'Which counties have Housing & Transportation as their dominant SVI theme?',
    sql: `SELECT c.county_name, c.region, sv.rpl_themes AS svi_overall, sv.rpl_theme4_housing_transport AS theme4
FROM social_vulnerability sv
JOIN counties c USING (fips)
WHERE sv.rpl_theme4_housing_transport >= COALESCE(sv.rpl_theme1_socioeconomic, 0)
  AND sv.rpl_theme4_housing_transport >= COALESCE(sv.rpl_theme2_household, 0)
  AND sv.rpl_theme4_housing_transport >= COALESCE(sv.rpl_theme3_minority, 0)
ORDER BY sv.rpl_theme4_housing_transport DESC
LIMIT 15`,
  },
];

// ---------- SQL validation ----------

export function validateSql(sql: string): { ok: boolean; error?: string; sql?: string } {
  const cleaned = sql.trim().replace(/;\s*$/, '');
  if (!cleaned) return { ok: false, error: 'Empty query.' };
  const upper = cleaned.toUpperCase();

  if (!/^(SELECT|WITH)\s/.test(upper)) {
    return { ok: false, error: 'Must start with SELECT or WITH.' };
  }
  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REPLACE|TRUNCATE|GRANT|REVOKE)\b/i;
  if (forbidden.test(cleaned)) {
    return { ok: false, error: 'Contains a forbidden keyword.' };
  }
  if (/;[\s]*\S/.test(cleaned)) {
    return { ok: false, error: 'Multi-statement queries are not allowed.' };
  }
  if (/--|\/\*/.test(cleaned)) {
    return { ok: false, error: 'Comments are not allowed.' };
  }
  const allowedTables = new Set([
    'counties',
    'data_sources',
    'measures',
    'taxonomies',
    'zcta_county_crosswalk',
    'health_indicators',
    'social_vulnerability',
    'providers',
    'provider_capacity',
    'v_equity_gap_index',
  ]);
  // crude table-reference check: look for FROM/JOIN <ident>.
  const tableRefs: string[] = [];
  const re = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    tableRefs.push(m[1]!.toLowerCase());
  }
  // Filter out CTE aliases by looking for `<name> AS (` declarations.
  const cteNames = new Set<string>();
  const cteRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  while ((m = cteRe.exec(cleaned)) !== null) {
    cteNames.add(m[1]!.toLowerCase());
  }
  for (const t of tableRefs) {
    if (cteNames.has(t)) continue;
    if (!allowedTables.has(t)) {
      return { ok: false, error: `Table not whitelisted: ${t}` };
    }
  }
  const finalSql = /\bLIMIT\b/i.test(cleaned) ? cleaned : `${cleaned}\nLIMIT 1000`;
  return { ok: true, sql: finalSql };
}

// ---------- SQL execution ----------

export interface AskExecResult {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  rowCount: number;
  truncated: boolean;
}

const HARD_LIMIT = 1000;

export function executeSafely(sql: string): AskExecResult {
  const stmt = db().prepare(sql);
  stmt.raw(true);
  const data = stmt.all() as Array<Array<unknown>>;
  const truncated = data.length >= HARD_LIMIT;
  const columns = (stmt.columns() as Array<{ name: string }>).map((c) => c.name);
  const rows = data.slice(0, HARD_LIMIT).map((row) =>
    row.map((v) => (v === null || v === undefined ? null : typeof v === 'bigint' ? Number(v) : v)),
  ) as Array<Array<string | number | null>>;
  return { columns, rows, rowCount: data.length, truncated };
}

// ---------- LLM ----------

const SCHEMA_SUMMARY = `
TABLE counties (fips PK, county_name, region IN ('Delta','Coastal','Pine Belt','Other'), is_delta 0/1, is_rural 0/1, population, latitude, longitude)
TABLE measures (measure_id PK, measure_short, measure_full, category, is_in_burden_composite 0/1, polarity +1/-1)
TABLE taxonomies (taxonomy_code PK, taxonomy_label, is_primary_care 0/1)
TABLE health_indicators (fips, measure_id, year 2022-2023, data_value_type IN ('Crude prevalence','Age-adjusted prevalence'), data_value, low_ci, high_ci, total_population)
TABLE social_vulnerability (fips PK, svi_year, rpl_themes 0-1 overall intra-MS percentile, rpl_theme1_socioeconomic, rpl_theme2_household, rpl_theme3_minority, rpl_theme4_housing_transport, ep_pov150 0-100%, ep_uninsur, ep_unemp, ep_disabl, ep_minrty, ep_age65, ep_noveh, ...)
TABLE providers (npi PK, fips nullable, taxonomy_code, practice_zip5, is_active 0/1)
TABLE provider_capacity (fips, taxonomy_code, provider_count) — pre-aggregated
TABLE zcta_county_crosswalk (zcta5, fips, arealand_part, is_assigned)
TABLE data_sources (source_id PK, dataset_name, publisher, vintage)
VIEW v_equity_gap_index (fips, county_name, region, population, burden_component 0-100, capacity_component 0-100, vulnerability_component 0-100, egi_score 0-100, egi_rank 1-82, egi_quintile 1-5)
`.trim();

const FEW_SHOTS = `
Q: "Top 10 most-underserved counties"
A: { "sql": "SELECT county_name, region, egi_score, egi_rank FROM v_equity_gap_index ORDER BY egi_rank ASC LIMIT 10", "explanation": "Reads the precomputed view in rank order." }

Q: "Average diabetes prevalence in Delta counties"
A: { "sql": "WITH latest AS (SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id) SELECT ROUND(AVG(hi.data_value), 2) AS mean_diabetes_pct FROM health_indicators hi JOIN counties c USING (fips) JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year WHERE c.region = 'Delta' AND hi.measure_id = 'DIABETES' AND hi.data_value_type = 'Age-adjusted prevalence'", "explanation": "Latest-year diabetes prevalence averaged across Delta counties." }

Q: "Which county has zero primary-care providers?"
A: { "sql": "SELECT c.county_name, c.population FROM counties c LEFT JOIN provider_capacity pc ON pc.fips = c.fips GROUP BY c.fips, c.county_name, c.population HAVING COALESCE(SUM(pc.provider_count), 0) = 0", "explanation": "Counties where the sum of provider_count across all taxonomies is zero." }

Q: "Compare Holmes and Issaquena on every EGI component"
A: { "sql": "SELECT county_name, burden_component, capacity_component, vulnerability_component, egi_score, egi_rank FROM v_equity_gap_index WHERE county_name IN ('Holmes County', 'Issaquena County')", "explanation": "Direct projection from the view filtered to the two counties." }

Q: "How many counties are in each quintile?"
A: { "sql": "SELECT egi_quintile, COUNT(*) AS n FROM v_equity_gap_index GROUP BY egi_quintile ORDER BY egi_quintile", "explanation": "NTILE(5) buckets, 82 / 5 ≈ 16 per quintile (with a remainder)." }

Q: "Counties where socioeconomic vulnerability is the dominant SVI theme"
A: { "sql": "SELECT c.county_name, sv.rpl_theme1_socioeconomic FROM social_vulnerability sv JOIN counties c USING (fips) WHERE sv.rpl_theme1_socioeconomic >= COALESCE(sv.rpl_theme2_household, 0) AND sv.rpl_theme1_socioeconomic >= COALESCE(sv.rpl_theme3_minority, 0) AND sv.rpl_theme1_socioeconomic >= COALESCE(sv.rpl_theme4_housing_transport, 0) ORDER BY sv.rpl_theme1_socioeconomic DESC", "explanation": "Filter SVI rows where Theme 1 ≥ each of the other three." }

Q: "Average pcp_per_10k by region"
A: { "sql": "SELECT c.region, ROUND(AVG(1.0 * pc.total_providers * 10000.0 / c.population), 2) AS mean_pcp_per_10k FROM (SELECT fips, SUM(provider_count) AS total_providers FROM provider_capacity GROUP BY fips) pc JOIN counties c USING (fips) GROUP BY c.region ORDER BY mean_pcp_per_10k", "explanation": "Per-county pcp_per_10k then averaged within region." }

Q: "Counties with rural=1 AND vulnerability above 90"
A: { "sql": "SELECT v.county_name, c.population, v.vulnerability_component FROM v_equity_gap_index v JOIN counties c USING (fips) WHERE c.is_rural = 1 AND v.vulnerability_component > 90 ORDER BY v.vulnerability_component DESC", "explanation": "Join the view to counties for the rurality filter." }
`.trim();

const SYSTEM_PROMPT = `You are a SQL assistant for the Mississippi Health Equity Gap Index workbench. Translate a researcher's natural-language question into a single SQLite SELECT (or WITH … SELECT) query.

# Schema
${SCHEMA_SUMMARY}

# Rules (hard constraints)
- Output a single JSON object: { "sql": "<query>", "explanation": "<1 sentence>" }. No prose outside the JSON.
- You may only generate SELECT queries (optionally beginning with WITH).
- You may NOT use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, ATTACH, DETACH, PRAGMA, VACUUM, REPLACE, TRUNCATE, GRANT, or REVOKE.
- You may only query these tables/view: counties, data_sources, measures, taxonomies, zcta_county_crosswalk, health_indicators, social_vulnerability, providers, provider_capacity, v_equity_gap_index.
- Do not use multi-statement queries (no semicolons inside the body).
- Do not use SQL comments (no -- or /* ... */).
- If the question cannot be answered with a SELECT, return { "error": "<reason>" } instead.
- For PLACES/health_indicators queries, filter to data_value_type = 'Age-adjusted prevalence' for cross-county comparisons, and pick latest year per measure (see examples).
- All FIPS are 5-char strings starting with '28'. Region values are exact strings: 'Delta', 'Coastal', 'Pine Belt', 'Other'.
- Prefer reading from v_equity_gap_index when EGI scores or ranks are involved.

# Few-shot examples
${FEW_SHOTS}
`;

let cachedClient: Groq | null = null;
function client(): Groq | null {
  if (cachedClient) return cachedClient;
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  cachedClient = new Groq({ apiKey: key });
  return cachedClient;
}

export async function askLLM(question: string): Promise<{
  sql: string;
  explanation: string;
} | { error: string }> {
  const groq = client();
  if (!groq) return { error: 'GROQ_API_KEY is not configured on the server.' };

  const completion = await groq.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.0,
    max_tokens: 600,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'LLM response was not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'LLM response had no usable fields.' };
  }
  const obj = parsed as { sql?: string; explanation?: string; error?: string };
  if (obj.error) return { error: obj.error };
  if (!obj.sql) return { error: 'LLM did not return a SQL query.' };
  return { sql: obj.sql, explanation: obj.explanation ?? '' };
}

export async function summarizeResults(
  question: string,
  columns: string[],
  rows: Array<Array<string | number | null>>,
): Promise<string> {
  const groq = client();
  if (!groq) return '';
  if (rows.length === 0) return 'No rows match the query.';
  // Constrain the preview the LLM sees so we don't blow context.
  const sample = rows.slice(0, 20).map((r) =>
    Object.fromEntries(columns.map((c, i) => [c, r[i]])),
  );
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.0,
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content:
          'Summarize a SQL result for a non-technical health-research user in 1–2 sentences. Do not invent numbers. Mention 1–3 specific counties or values from the data. No JSON, no markdown, no leading "The result shows".',
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nColumns: ${columns.join(', ')}\nFirst rows: ${JSON.stringify(sample)}\nTotal rows returned: ${rows.length}`,
      },
    ],
  });
  return (completion.choices?.[0]?.message?.content ?? '').trim();
}

// ---------- High-level orchestration used by the route handler ----------

export async function runAsk(question: string): Promise<AskResponse> {
  const chip = STARTER_CHIPS.find(
    (c) => c.question.toLowerCase() === question.toLowerCase(),
  );
  if (chip) {
    const validated = validateSql(chip.sql);
    if (!validated.ok || !validated.sql) {
      return chipFailure(question, chip.sql, validated.error ?? 'Chip SQL failed validation.');
    }
    return executeForResponse(question, chip.sql, validated.sql, 'chip', 'Hardcoded chip query.');
  }
  const llmOut = await askLLM(question);
  if ('error' in llmOut) {
    return {
      question,
      sql: '',
      explanation: '',
      summary: '',
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      source: 'llm',
      error: llmOut.error,
    };
  }
  const validated = validateSql(llmOut.sql);
  if (!validated.ok || !validated.sql) {
    return {
      question,
      sql: llmOut.sql,
      explanation: llmOut.explanation,
      summary: '',
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      source: 'llm',
      error: validated.error ?? 'SQL failed validation.',
    };
  }
  return executeForResponse(question, llmOut.sql, validated.sql, 'llm', llmOut.explanation);
}

async function executeForResponse(
  question: string,
  displaySql: string,
  execSql: string,
  source: 'chip' | 'llm',
  explanation: string,
): Promise<AskResponse> {
  try {
    const exec = executeSafely(execSql);
    let summary = '';
    if (source === 'llm') {
      summary = await summarizeResults(question, exec.columns, exec.rows).catch(() => '');
    } else {
      summary = `Returned ${exec.rowCount} ${exec.rowCount === 1 ? 'row' : 'rows'}.`;
    }
    return {
      question,
      sql: displaySql,
      explanation,
      summary,
      columns: exec.columns.map((name) => ({ name })),
      rows: exec.rows,
      rowCount: exec.rowCount,
      truncated: exec.truncated,
      source,
    };
  } catch (err) {
    return {
      question,
      sql: displaySql,
      explanation,
      summary: '',
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      source,
      error: err instanceof Error ? err.message : 'SQL execution failed.',
    };
  }
}

function chipFailure(question: string, sql: string, error: string): AskResponse {
  return {
    question,
    sql,
    explanation: '',
    summary: '',
    columns: [],
    rows: [],
    rowCount: 0,
    truncated: false,
    source: 'chip',
    error,
  };
}
