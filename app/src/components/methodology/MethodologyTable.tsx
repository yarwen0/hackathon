import Link from 'next/link';
import type { MethodologyRanking } from '@/lib/types';
import { formatScore } from '@/lib/utils';

interface Props {
  ranking: MethodologyRanking;
  highlight?: Set<string>;
}

export function MethodologyTable({ ranking, highlight }: Props) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-muted-foreground mb-1">
        {ranking.label}
      </div>
      <div className="font-display text-xl">{ranking.top10[0]?.county_name.replace(' County', '')}</div>
      <div className="text-xs text-muted-foreground tabular mt-1">
        weights{' '}
        <span className="text-foreground font-mono">
          {(ranking.weights.burden * 100).toFixed(0)} /{' '}
          {(ranking.weights.capacity * 100).toFixed(0)} /{' '}
          {(ranking.weights.vulnerability * 100).toFixed(0)}
        </span>
        <span className="ml-1">B / C / V</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground max-w-prose leading-relaxed">{ranking.description}</p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-2xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-1.5 px-2 text-right w-8">#</th>
            <th scope="col" className="py-1.5 px-2 text-left">County</th>
            <th scope="col" className="py-1.5 px-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {ranking.top10.map((c) => {
            const hl = highlight?.has(c.fips);
            return (
              <tr key={c.fips} className={`border-b last:border-b-0 ${hl ? 'bg-accent/5' : ''}`}>
                <td className="py-1.5 px-2 text-right font-mono tabular">{c.rank}</td>
                <td className="py-1.5 px-2">
                  <Link href={`/county/${c.fips}`} className="hover:text-accent transition-colors">
                    {c.county_name.replace(' County', '')}
                  </Link>
                </td>
                <td className="py-1.5 px-2 text-right tabular">{formatScore(c.score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
