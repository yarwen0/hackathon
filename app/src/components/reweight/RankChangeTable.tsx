import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ReweightRow } from '@/lib/types';
import { formatScore } from '@/lib/utils';

interface Props {
  rows: ReweightRow[];
  limit?: number;
}

export function RankChangeTable({ rows, limit = 15 }: Props) {
  const top = rows.slice(0, limit);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-2xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-2 px-3 text-right">Rank</th>
            <th scope="col" className="py-2 px-3 text-left">County</th>
            <th scope="col" className="py-2 px-3 text-left">Region</th>
            <th scope="col" className="py-2 px-3 text-right">Score</th>
            <th scope="col" className="py-2 px-3 text-right">vs baseline</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => {
            const delta = r.rank_change;
            const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
            const tone = delta > 0 ? 'text-success' : delta < 0 ? 'text-accent' : 'text-muted-foreground';
            return (
              <tr key={r.fips} className="border-b last:border-b-0">
                <td className="py-2 px-3 text-right tabular font-mono">{r.reweighted_rank}</td>
                <td className="py-2 px-3">
                  <Link
                    href={`/county/${r.fips}`}
                    className="hover:text-accent transition-colors"
                  >
                    {r.county_name.replace(' County', '')}
                  </Link>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{r.region}</td>
                <td className="py-2 px-3 text-right tabular">{formatScore(r.reweighted_score)}</td>
                <td className={`py-2 px-3 text-right tabular ${tone}`}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Icon size={10} aria-hidden />
                    {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                    {delta !== 0 ? <span className="sr-only">{delta > 0 ? 'improved' : 'fell'}</span> : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
