// @react-pdf/renderer report. Times-Roman + Helvetica are guaranteed built-in
// fonts; we lean on Times-Roman for the editorial headlines and Helvetica for
// body, which mirrors the screen's Fraunces + IBM Plex pairing at the
// constraint of zero font-embedding.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CohortCriteria, CohortResponse, CountyRow, DataSource } from '@/lib/types';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 56, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1612', backgroundColor: '#fbf9f4' },
  brandBar: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#1a1612', paddingBottom: 6, marginBottom: 24 },
  brandLeft: { fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  brandRight: { fontSize: 8, color: '#6b6258' },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6b6258', marginBottom: 6 },
  hero: { fontFamily: 'Times-Roman', fontSize: 38, lineHeight: 1.05, marginBottom: 10 },
  subhead: { fontFamily: 'Times-Roman', fontSize: 18, marginBottom: 8, marginTop: 22 },
  bodyP: { fontSize: 10, lineHeight: 1.5, color: '#1a1612', maxWidth: 460, marginBottom: 6 },
  statsRow: { flexDirection: 'row', gap: 28, marginTop: 18, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: '#cbc4b6' },
  statBlock: { width: '23%' },
  statLabel: { fontSize: 7, letterSpacing: 1.4, textTransform: 'uppercase', color: '#6b6258' },
  statValue: { fontFamily: 'Times-Roman', fontSize: 22, marginTop: 4 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#1a1612', paddingBottom: 5, marginTop: 14, marginBottom: 4 },
  th: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6b6258' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.25, borderBottomColor: '#e9e4d8' },
  cell: { fontSize: 9 },
  right: { textAlign: 'right' },
  driverList: { marginTop: 8 },
  driverItem: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: '#8b1e1e' },
  driverVal: { fontFamily: 'Times-Roman', fontSize: 16 },
  driverLabel: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6b6258', marginTop: 1 },
  sourceCard: { borderLeftWidth: 1, borderLeftColor: '#cbc4b6', paddingLeft: 8, marginBottom: 10 },
  sourcePub: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: '#8b1e1e' },
  sourceName: { fontFamily: 'Times-Roman', fontSize: 11, marginTop: 2 },
  sourceMeta: { fontSize: 7, color: '#6b6258', marginTop: 2 },
  appendixHeader: { marginTop: 22, fontFamily: 'Times-Roman', fontSize: 14, borderBottomWidth: 0.5, borderBottomColor: '#1a1612', paddingBottom: 4, marginBottom: 8 },
  appendix: { fontFamily: 'Courier', fontSize: 7.5, lineHeight: 1.4, color: '#1a1612' },
  footer: { position: 'absolute', bottom: 24, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#6b6258', borderTopWidth: 0.5, borderTopColor: '#cbc4b6', paddingTop: 6 },
});

interface Props {
  cohort: CohortResponse;
  dataSources: DataSource[];
  generatedAt: string;
  generatedBy?: string;
  generatedByEmail?: string;
}

const fmtInt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtScore = (n: number) => n.toFixed(1);

export function CohortReport({ cohort, dataSources, generatedAt, generatedBy, generatedByEmail }: Props) {
  const { rows, stats, criteria } = cohort;
  const criteriaSummary = summarizeCriteria(criteria);
  const top10: CountyRow[] = rows.slice(0, 10);
  return (
    <Document
      title={`EGI Cohort Report — ${rows.length} counties`}
      author="EGI Workbench · Gulf South Center"
      subject="Mississippi Health Equity Gap Index — cohort report"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar} fixed>
          <Text style={styles.brandLeft}>EGI WORKBENCH</Text>
          <Text style={styles.brandRight}>
            {generatedBy ? `Prepared by ${generatedBy}` : 'Cohort report'} · {generatedAt}
          </Text>
        </View>

        <Text style={styles.eyebrow}>Mississippi Health Equity Gap Index · cohort report</Text>
        <Text style={styles.hero}>
          {rows.length === 0 ? 'Empty cohort' : `${rows.length}-county cohort`}
        </Text>
        <Text style={styles.bodyP}>
          Cohort criteria: {criteriaSummary}.
        </Text>
        <Text style={styles.bodyP}>
          Total population {fmtInt(stats.totalPopulation)}. Median EGI {fmtScore(stats.medianEgi)}{' '}
          ({fmtScore(stats.medianEgi - 50)} above the state midpoint).
          {stats.regionBreakdown.length > 0
            ? ` Region mix: ${stats.regionBreakdown.map((r) => `${r.region} (${r.count})`).join(', ')}.`
            : ''}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>COUNTIES</Text>
            <Text style={styles.statValue}>{rows.length}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>POPULATION</Text>
            <Text style={styles.statValue}>{fmtInt(stats.totalPopulation)}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>MEDIAN EGI</Text>
            <Text style={styles.statValue}>{rows.length ? fmtScore(stats.medianEgi) : '—'}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>MEAN BURDEN</Text>
            <Text style={styles.statValue}>{rows.length ? fmtScore(stats.meanBurden) : '—'}</Text>
          </View>
        </View>

        <Text style={styles.subhead}>Top burden drivers across cohort</Text>
        <View style={styles.driverList}>
          {stats.topDrivers.length === 0 ? (
            <Text style={styles.bodyP}>No drivers (empty cohort).</Text>
          ) : (
            stats.topDrivers.map((d) => (
              <View key={d.measure_short} style={styles.driverItem}>
                <Text style={styles.driverVal}>
                  {d.mean_value.toFixed(1)}% · {d.measure_short}
                </Text>
                <Text style={styles.driverLabel}>
                  state mean {d.state_mean.toFixed(1)}% · cohort delta {(d.mean_value - d.state_mean).toFixed(1)} pts
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.subhead}>Counties in cohort (top {Math.min(rows.length, 10)} shown; full list on page 2)</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: 22 }]}>#</Text>
          <Text style={[styles.th, { width: '34%' }]}>County</Text>
          <Text style={[styles.th, { width: '14%' }]}>Region</Text>
          <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Population</Text>
          <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>B</Text>
          <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>C</Text>
          <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>V</Text>
          <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>EGI</Text>
        </View>
        {top10.map((r) => (
          <View key={r.fips} style={styles.row}>
            <Text style={[styles.cell, { width: 22 }]}>{r.egi_rank}</Text>
            <Text style={[styles.cell, { width: '34%' }]}>{r.county_name}</Text>
            <Text style={[styles.cell, { width: '14%' }]}>{r.region}</Text>
            <Text style={[styles.cell, { width: '14%' }, styles.right]}>{fmtInt(r.population)}</Text>
            <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.burden_component)}</Text>
            <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.capacity_component)}</Text>
            <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.vulnerability_component)}</Text>
            <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.egi_score)}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Gulf South Center · EGI Workbench</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {rows.length > 10 ? (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.brandBar} fixed>
            <Text style={styles.brandLeft}>EGI WORKBENCH · CONT.</Text>
            <Text style={styles.brandRight}>
              {generatedBy ? `Prepared by ${generatedBy}` : 'Cohort report'} · {generatedAt}
            </Text>
          </View>
          <Text style={styles.subhead}>All counties in cohort</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: 22 }]}>#</Text>
            <Text style={[styles.th, { width: '34%' }]}>County</Text>
            <Text style={[styles.th, { width: '14%' }]}>Region</Text>
            <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Population</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>B</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>C</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>V</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'right' }]}>EGI</Text>
          </View>
          {rows.map((r) => (
            <View key={r.fips} style={styles.row} wrap={false}>
              <Text style={[styles.cell, { width: 22 }]}>{r.egi_rank}</Text>
              <Text style={[styles.cell, { width: '34%' }]}>{r.county_name}</Text>
              <Text style={[styles.cell, { width: '14%' }]}>{r.region}</Text>
              <Text style={[styles.cell, { width: '14%' }, styles.right]}>{fmtInt(r.population)}</Text>
              <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.burden_component)}</Text>
              <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.capacity_component)}</Text>
              <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.vulnerability_component)}</Text>
              <Text style={[styles.cell, { width: '8%' }, styles.right]}>{fmtScore(r.egi_score)}</Text>
            </View>
          ))}
          <View style={styles.footer} fixed>
            <Text>Gulf South Center · EGI Workbench</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ) : null}

      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar} fixed>
          <Text style={styles.brandLeft}>EGI WORKBENCH · METHODOLOGY</Text>
          <Text style={styles.brandRight}>
            {generatedByEmail ? `Prepared for ${generatedByEmail}` : 'Cohort report'} · {generatedAt}
          </Text>
        </View>
        <Text style={styles.subhead}>Methodology in brief</Text>
        <Text style={styles.bodyP}>
          The Equity Gap Index combines three independent federal data programs into a single
          0–100 underservedness score per Mississippi county. Burden is an average of ten CDC
          PLACES chronic-disease + healthcare-access measures, each min-max normalized and
          polarity-adjusted (D-011). Capacity is primary-care providers per 10,000 residents
          inverted so high = scarcity (D-008, D-010 amended). Vulnerability is the CDC/ATSDR SVI
          2022 overall percentile, intra-Mississippi. Equal-thirds weighting per D-016.
        </Text>
        <Text style={styles.bodyP}>
          For methodology stress-testing, the EGI Workbench&apos;s Reweight Lab allows live
          adjustment of the three weights and shows which counties move under alternative
          weightings. The Methodology page also shows side-by-side top-10 rankings under
          equal-thirds, data-driven PCA, and burden-weighted (50/30/20) schemes.
        </Text>

        <Text style={styles.subhead}>Data sources</Text>
        {dataSources.map((s) => (
          <View key={s.source_id} style={styles.sourceCard}>
            <Text style={styles.sourcePub}>{s.publisher}</Text>
            <Text style={styles.sourceName}>{s.dataset_name}</Text>
            <Text style={styles.sourceMeta}>
              Vintage {s.vintage} · retrieved {s.retrieval_date}
              {s.rows_loaded !== null ? ` · ${fmtInt(s.rows_loaded)} rows` : ''}
            </Text>
            {s.notes ? <Text style={styles.sourceMeta}>{s.notes}</Text> : null}
          </View>
        ))}

        <Text style={styles.appendixHeader}>Appendix · the SQL behind the EGI view</Text>
        <Text style={styles.appendix}>{APPENDIX_SQL}</Text>

        <View style={styles.footer} fixed>
          <Text>Gulf South Center · EGI Workbench</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

const APPENDIX_SQL = `CREATE VIEW v_equity_gap_index AS
WITH weights AS (SELECT 1.0/3.0 AS w_b, 1.0/3.0 AS w_c, 1.0/3.0 AS w_v),
latest AS (SELECT measure_id, MAX(year) AS y FROM health_indicators GROUP BY measure_id),
burden_raw AS (SELECT hi.fips, hi.measure_id, m.polarity * hi.data_value AS pv
               FROM health_indicators hi JOIN measures m USING (measure_id)
               JOIN latest l ON l.measure_id = hi.measure_id AND l.y = hi.year
               WHERE m.is_in_burden_composite = 1
                 AND hi.data_value_type = 'Age-adjusted prevalence'
                 AND hi.data_value IS NOT NULL),
burden_normalized AS (
    SELECT fips, measure_id,
           100.0 * (pv - MIN(pv) OVER (PARTITION BY measure_id))
                 / NULLIF(MAX(pv) OVER (PARTITION BY measure_id)
                        - MIN(pv) OVER (PARTITION BY measure_id), 0) AS s
    FROM burden_raw),
burden_per_county AS (SELECT fips, AVG(s) AS b FROM burden_normalized GROUP BY fips),
capacity_total AS (SELECT fips, SUM(provider_count) AS tot FROM provider_capacity GROUP BY fips),
capacity_raw AS (SELECT c.fips, 1.0 * ct.tot * 10000.0 / c.population AS pcp
                 FROM counties c JOIN capacity_total ct USING (fips)),
capacity_scored AS (
    SELECT fips, 100.0 - 100.0 * (pcp - MIN(pcp) OVER ())
                                / NULLIF(MAX(pcp) OVER () - MIN(pcp) OVER (), 0) AS c
    FROM capacity_raw),
vulnerability_scored AS (
    SELECT fips, 100.0 * (rpl_themes - MIN(rpl_themes) OVER ())
                       / NULLIF(MAX(rpl_themes) OVER () - MIN(rpl_themes) OVER (), 0) AS v
    FROM social_vulnerability),
combined AS (SELECT b.fips, b.b AS B, cs.c AS C, vs.v AS V,
                    w.w_b*b.b + w.w_c*cs.c + w.w_v*vs.v AS egi_score
             FROM burden_per_county b
             JOIN capacity_scored cs USING (fips)
             JOIN vulnerability_scored vs USING (fips) CROSS JOIN weights w)
SELECT c.fips, c.county_name, c.region, c.population,
       ROUND(co.B, 2) AS burden_component,
       ROUND(co.C, 2) AS capacity_component,
       ROUND(co.V, 2) AS vulnerability_component,
       ROUND(co.egi_score, 2) AS egi_score,
       DENSE_RANK() OVER (ORDER BY co.egi_score DESC) AS egi_rank,
       NTILE(5)     OVER (ORDER BY co.egi_score DESC) AS egi_quintile
FROM combined co JOIN counties c USING (fips)
ORDER BY co.egi_score DESC, co.V DESC, c.population DESC, c.fips ASC;`;

function summarizeCriteria(c: CohortCriteria): string {
  const parts: string[] = [];
  if (c.region?.length) parts.push(`region ∈ {${c.region.join(', ')}}`);
  if (c.rural === true) parts.push('rural (pop < 50k)');
  if (c.rural === false) parts.push('urban (pop ≥ 50k)');
  if (c.quintile?.length) parts.push(`quintile ∈ {${c.quintile.join(', ')}}`);
  const range = (label: string, min: number | undefined, max: number | undefined) => {
    if (typeof min === 'number' && typeof max === 'number') parts.push(`${label} ∈ [${min}, ${max}]`);
    else if (typeof min === 'number') parts.push(`${label} ≥ ${min}`);
    else if (typeof max === 'number') parts.push(`${label} ≤ ${max}`);
  };
  range('EGI', c.egiMin, c.egiMax);
  range('burden', c.burdenMin, c.burdenMax);
  range('capacity', c.capacityMin, c.capacityMax);
  range('vulnerability', c.vulnerabilityMin, c.vulnerabilityMax);
  range('population', c.populationMin, c.populationMax);
  if (typeof c.diabetesMin === 'number') parts.push(`diabetes ≥ ${c.diabetesMin}%`);
  if (typeof c.obesityMin === 'number') parts.push(`obesity ≥ ${c.obesityMin}%`);
  if (typeof c.uninsuredMin === 'number') parts.push(`uninsured ≥ ${c.uninsuredMin}%`);
  if (typeof c.fmPer10kMax === 'number') parts.push(`family-medicine per 10k ≤ ${c.fmPer10kMax}`);
  return parts.length ? parts.join(', ') : 'no filters (all 82 counties)';
}
