'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';
import type { CountyRow } from '@/lib/types';
import { formatInt, formatScore } from '@/lib/utils';
import { QuintileBadge } from '@/components/ui/QuintileBadge';
import { AuditTooltip } from '@/components/ui/AuditTooltip';

interface Props {
  rows: CountyRow[];
  sortKey: keyof CountyRow | undefined;
  sortDir: 'asc' | 'desc';
  onSort: (key: keyof CountyRow) => void;
  highlightFips?: string | null;
  onHover?: (fips: string | null) => void;
}

interface Column {
  key: keyof CountyRow;
  label: string;
  align?: 'left' | 'right';
  audit?: string;
  render: (row: CountyRow) => React.ReactNode;
}

export function RankingTable({ rows, sortKey, sortDir, onSort, highlightFips, onHover }: Props) {
  const cols = useMemo<Column[]>(
    () => [
      {
        key: 'egi_rank',
        label: 'Rank',
        align: 'right',
        audit: 'egi_rank',
        render: (r) => <span className="font-mono tabular">{r.egi_rank}</span>,
      },
      {
        key: 'county_name',
        label: 'County',
        render: (r) => (
          <Link
            href={`/county/${r.fips}`}
            className="hover:text-accent transition-colors"
          >
            {r.county_name.replace(' County', '')}
          </Link>
        ),
      },
      {
        key: 'region',
        label: 'Region',
        render: (r) => <span className="text-muted-foreground">{r.region}</span>,
      },
      {
        key: 'population',
        label: 'Population',
        align: 'right',
        render: (r) => <span className="tabular">{formatInt(r.population)}</span>,
      },
      {
        key: 'burden_component',
        label: 'Burden',
        align: 'right',
        audit: 'burden_component',
        render: (r) => <span className="tabular">{formatScore(r.burden_component)}</span>,
      },
      {
        key: 'capacity_component',
        label: 'Capacity',
        align: 'right',
        audit: 'capacity_component',
        render: (r) => <span className="tabular">{formatScore(r.capacity_component)}</span>,
      },
      {
        key: 'vulnerability_component',
        label: 'Vulnerability',
        align: 'right',
        audit: 'vulnerability_component',
        render: (r) => <span className="tabular">{formatScore(r.vulnerability_component)}</span>,
      },
      {
        key: 'egi_score',
        label: 'EGI',
        align: 'right',
        audit: 'egi_score',
        render: (r) => (
          <span className="font-mono tabular font-medium">{formatScore(r.egi_score)}</span>
        ),
      },
      {
        key: 'egi_quintile',
        label: 'Q',
        render: (r) => <QuintileBadge quintile={r.egi_quintile} />,
      },
    ],
    [],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-2xs uppercase tracking-wider text-muted-foreground border-b">
            {cols.map((c) => {
              const active = sortKey === c.key;
              const Icon = sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={String(c.key)}
                  scope="col"
                  className={`py-2 px-3 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                      active ? 'text-foreground' : ''
                    }`}
                  >
                    {c.label}
                    {active ? <Icon size={10} aria-hidden /> : null}
                  </button>
                  {c.audit ? <AuditTooltip metricId={c.audit} className="ml-1" /> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hl = highlightFips === r.fips;
            return (
              <tr
                key={r.fips}
                className={`border-b last:border-b-0 transition-colors ${
                  hl ? 'bg-muted/70' : 'hover:bg-muted/40'
                }`}
                onMouseEnter={() => onHover?.(r.fips)}
                onMouseLeave={() => onHover?.(null)}
              >
                {cols.map((c) => (
                  <td
                    key={String(c.key)}
                    className={`py-2.5 px-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
