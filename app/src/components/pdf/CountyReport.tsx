import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CountyResponse, DataSource } from '@/lib/types';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 56, fontFamily: 'Helvetica', fontSize: 9, color: '#1a1612', backgroundColor: '#fbf9f4' },
  brandBar: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#1a1612', paddingBottom: 6, marginBottom: 24 },
  brandLeft: { fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  brandRight: { fontSize: 8, color: '#6b6258' },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6b6258', marginBottom: 6 },
  hero: { fontFamily: 'Times-Roman', fontSize: 38, lineHeight: 1.05, marginBottom: 4 },
  meta: { fontSize: 9, color: '#6b6258', marginBottom: 14 },
  bodyP: { fontSize: 10, lineHeight: 1.5, color: '#1a1612', maxWidth: 460, marginBottom: 10 },
  subhead: { fontFamily: 'Times-Roman', fontSize: 16, marginBottom: 8, marginTop: 18 },
  statsRow: { flexDirection: 'row', gap: 28, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#cbc4b6', marginBottom: 10 },
  statBlock: { width: '28%' },
  statLabel: { fontSize: 7, letterSpacing: 1.4, textTransform: 'uppercase', color: '#6b6258' },
  statValue: { fontFamily: 'Times-Roman', fontSize: 26, marginTop: 4 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#1a1612', paddingBottom: 4, marginTop: 8, marginBottom: 4 },
  th: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6b6258' },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.25, borderBottomColor: '#e9e4d8' },
  cell: { fontSize: 9 },
  right: { textAlign: 'right' },
  componentBar: { marginBottom: 8 },
  componentHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  componentLabel: { fontSize: 10 },
  componentVal: { fontSize: 11, fontFamily: 'Times-Roman' },
  barTrack: { height: 4, backgroundColor: '#e9e4d8' },
  barFill: { height: 4 },
  sourceCard: { borderLeftWidth: 1, borderLeftColor: '#cbc4b6', paddingLeft: 8, marginBottom: 8 },
  sourcePub: { fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', color: '#8b1e1e' },
  sourceName: { fontFamily: 'Times-Roman', fontSize: 11, marginTop: 2 },
  footer: { position: 'absolute', bottom: 24, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#6b6258', borderTopWidth: 0.5, borderTopColor: '#cbc4b6', paddingTop: 6 },
});

const COLOR = {
  low: '#1d6e3a',
  mid: '#e6c84d',
  high: '#8b1e1e',
};

function colorForScore(s: number): string {
  if (s < 50) return COLOR.low;
  if (s < 75) return COLOR.mid;
  return COLOR.high;
}

const fmtInt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

interface Props {
  county: CountyResponse;
  dataSources: DataSource[];
  generatedAt: string;
}

export function CountyReport({ county, dataSources, generatedAt }: Props) {
  const c = county.county;
  const componentsData = [
    { label: 'Burden', value: c.burden_component, mean: county.stateMeans.burden, sub: 'PLACES — chronic disease + access' },
    { label: 'Capacity', value: c.capacity_component, mean: county.stateMeans.capacity, sub: 'NPPES + ACS — primary-care scarcity' },
    { label: 'Vulnerability', value: c.vulnerability_component, mean: county.stateMeans.vulnerability, sub: 'SVI — intra-MS social vulnerability' },
  ];

  return (
    <Document
      title={`EGI County Report — ${c.county_name}`}
      author="EGI Workbench · Gulf South Center"
      subject={`Mississippi Health Equity Gap Index — ${c.county_name}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brandBar} fixed>
          <Text style={styles.brandLeft}>EGI WORKBENCH · COUNTY PROFILE</Text>
          <Text style={styles.brandRight}>{generatedAt} · FIPS {c.fips}</Text>
        </View>

        <Text style={styles.eyebrow}>Mississippi Health Equity Gap Index · county profile</Text>
        <Text style={styles.hero}>{c.county_name}</Text>
        <Text style={styles.meta}>
          {c.region} region · {c.is_rural ? 'Rural' : 'Urban'} · population {fmtInt(c.population)}
        </Text>
        <Text style={styles.bodyP}>{county.interpretation}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>EGI Rank</Text>
            <Text style={styles.statValue}>#{c.egi_rank}</Text>
            <Text style={[styles.statLabel, { marginTop: 4 }]}>of 82 MS counties</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>EGI Score</Text>
            <Text style={styles.statValue}>{c.egi_score.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { marginTop: 4 }]}>state mean {county.stateMeans.egi.toFixed(1)}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Quintile</Text>
            <Text style={styles.statValue}>Q{c.egi_quintile}</Text>
            <Text style={[styles.statLabel, { marginTop: 4 }]}>1 = most underserved</Text>
          </View>
        </View>

        <Text style={styles.subhead}>Component breakdown</Text>
        {componentsData.map((b) => (
          <View key={b.label} style={styles.componentBar}>
            <View style={styles.componentHead}>
              <Text style={styles.componentLabel}>{b.label}<Text style={{ color: '#6b6258', fontSize: 8 }}>  ·  {b.sub}</Text></Text>
              <Text style={styles.componentVal}>{b.value.toFixed(1)}<Text style={{ fontSize: 8, color: '#6b6258' }}>  vs {b.mean.toFixed(1)}</Text></Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${b.value}%`, backgroundColor: colorForScore(b.value) }]} />
            </View>
          </View>
        ))}

        <Text style={styles.subhead}>Top burden drivers</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { width: '46%' }]}>Measure</Text>
          <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>County</Text>
          <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>State mean</Text>
          <Text style={[styles.th, { width: '12%', textAlign: 'right' }]}>Δ</Text>
          <Text style={[styles.th, { width: '12%' }]}>Vintage</Text>
        </View>
        {county.drivers.filter((d) => d.deviation > 0).slice(0, 6).map((d) => (
          <View key={d.measure_id} style={styles.row}>
            <Text style={[styles.cell, { width: '46%' }]}>{d.measure_short}<Text style={{ color: '#6b6258', fontSize: 7 }}>  ·  {d.category}</Text></Text>
            <Text style={[styles.cell, { width: '15%' }, styles.right]}>{d.value.toFixed(1)}%</Text>
            <Text style={[styles.cell, { width: '15%' }, styles.right]}>{d.state_mean.toFixed(1)}%</Text>
            <Text style={[styles.cell, { width: '12%', color: '#8b1e1e' }, styles.right]}>+{Math.abs(d.deviation).toFixed(1)}</Text>
            <Text style={[styles.cell, { width: '12%', color: '#6b6258', fontSize: 7 }]}>BRFSS {d.year}</Text>
          </View>
        ))}

        <Text style={styles.subhead}>Provider mix · {county.totalProviders} providers · {county.providersPer10k.toFixed(2)} per 10k</Text>
        {county.totalProviders === 0 ? (
          <Text style={styles.bodyP}>
            Zero county-attributed primary-care providers under the largest-AREALAND_PART
            ZIP→county attribution (D-010 amended).
          </Text>
        ) : (
          <>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { width: '50%' }]}>Taxonomy</Text>
              <Text style={[styles.th, { width: '20%', textAlign: 'right' }]}>Providers</Text>
              <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>per 10k</Text>
              <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Share</Text>
            </View>
            {county.providers.map((p) => (
              <View key={p.taxonomy_code} style={styles.row}>
                <Text style={[styles.cell, { width: '50%' }]}>{p.taxonomy_label}</Text>
                <Text style={[styles.cell, { width: '20%' }, styles.right]}>{p.provider_count}</Text>
                <Text style={[styles.cell, { width: '15%' }, styles.right]}>{p.per_10k.toFixed(2)}</Text>
                <Text style={[styles.cell, { width: '15%', color: '#6b6258' }, styles.right]}>
                  {((p.provider_count / county.totalProviders) * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.subhead}>Data sources</Text>
        {dataSources.map((s) => (
          <View key={s.source_id} style={styles.sourceCard}>
            <Text style={styles.sourcePub}>{s.publisher}</Text>
            <Text style={styles.sourceName}>{s.dataset_name}</Text>
            <Text style={[styles.statLabel, { marginTop: 2 }]}>
              Vintage {s.vintage} · retrieved {s.retrieval_date}
            </Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Gulf South Center · EGI Workbench</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
