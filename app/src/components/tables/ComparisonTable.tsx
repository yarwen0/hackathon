import { Fragment } from 'react';
import type { CompareResponse, CompareRow } from '@/lib/types';
import { formatInt, formatScore } from '@/lib/utils';
import { ProportionBar } from './ProportionBar';

interface Props {
  data: CompareResponse;
}

function formatValue(v: number | null, format: CompareRow['format'], unit: CompareRow['unit']): string {
  if (v === null || v === undefined) return '—';
  let s: string;
  switch (format) {
    case 'integer': s = formatInt(v); break;
    case 'decimal': s = v.toFixed(2); break;
    case 'percent': s = `${v.toFixed(1)}${unit === '%' ? '%' : ''}`; break;
    case 'score': s = formatScore(v); break;
    default: s = String(v);
  }
  if (format !== 'percent' && unit && unit !== '%') s = `${s} ${unit === 'people' ? '' : unit}`.trim();
  return s;
}

// Five-column grid shared by header and data rows so they align exactly.
// Order: metric (2fr) · A (1fr) · B (1fr) · Δ (1fr) · Proportion (2fr).
const GRID = 'grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-x-6 items-center';

export function ComparisonTable({ data }: Props) {
  const groups = ['Summary', 'Components', 'SVI Themes', 'Providers', 'Burden Drivers'] as const;
  const nameA = data.a.county_name.replace(' County', '');
  const nameB = data.b.county_name.replace(' County', '');

  return (
    <div className="overflow-x-auto" role="table" aria-label="County comparison">
      <div className={`${GRID} text-2xs uppercase tracking-wider text-muted-foreground border-b py-3`}>
        <div role="columnheader">Metric</div>
        <div role="columnheader" className="text-right">{nameA}</div>
        <div role="columnheader" className="text-right">{nameB}</div>
        <div role="columnheader" className="text-right">Δ</div>
        <div role="columnheader">Proportion</div>
      </div>

      {groups.map((g) => {
        const rows = data.rows.filter((r) => r.group === g);
        if (rows.length === 0) return null;
        return (
          <Fragment key={g}>
            <div className="pt-6 pb-2 text-2xs uppercase tracking-wider text-accent">{g}</div>
            {rows.map((r) => {
              const delta = r.a !== null && r.b !== null ? r.a - r.b : null;
              const deltaTone =
                delta === null
                  ? 'text-muted-foreground'
                  : (delta > 0 && r.higherIsWorse) || (delta < 0 && !r.higherIsWorse)
                  ? 'text-accent'
                  : (delta < 0 && r.higherIsWorse) || (delta > 0 && !r.higherIsWorse)
                  ? 'text-success'
                  : 'text-muted-foreground';
              const deltaStr =
                delta === null
                  ? '—'
                  : `${delta > 0 ? '+' : ''}${formatValue(delta, r.format, r.unit).replace(/\s/g, '')}`;
              return (
                <div
                  key={r.id}
                  className={`${GRID} text-sm border-b last:border-b-0 py-2.5`}
                  role="row"
                >
                  <div role="cell">{r.label}</div>
                  <div role="cell" className="text-right tabular">
                    {formatValue(r.a, r.format, r.unit)}
                  </div>
                  <div role="cell" className="text-right tabular">
                    {formatValue(r.b, r.format, r.unit)}
                  </div>
                  <div role="cell" className={`text-right tabular ${deltaTone}`}>
                    {deltaStr}
                  </div>
                  <div role="cell">
                    <ProportionBar a={r.a} b={r.b} labelA={nameA} labelB={nameB} />
                  </div>
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
