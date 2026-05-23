import { AuditTooltip } from '@/components/ui/AuditTooltip';
import type { CountyProviderRow } from '@/lib/types';

interface Props {
  rows: CountyProviderRow[];
  totalProviders: number;
  population: number;
}

export function ProviderBreakdown({ rows, totalProviders, population }: Props) {
  if (totalProviders === 0) {
    return (
      <div className="border-l-2 border-accent pl-4 py-2 text-sm">
        <div className="font-medium">Zero county-attributed primary-care providers</div>
        <div className="text-muted-foreground mt-1">
          This county has no NPPES providers in any of the six HRSA-aligned primary-care
          taxonomies after the largest-AREALAND_PART ZIP→county attribution (D-010 amended).
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs uppercase tracking-wider text-muted-foreground border-b">
            <th scope="col" className="py-2 px-3 text-left font-medium">
              Taxonomy
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              Providers
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              per 10k
              <AuditTooltip metricId="pcp_per_10k" className="ml-1" />
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const share = totalProviders ? (r.provider_count / totalProviders) * 100 : 0;
            return (
              <tr key={r.taxonomy_code} className="border-b last:border-b-0">
                <td className="py-2.5 px-3">{r.taxonomy_label}</td>
                <td className="py-2.5 px-3 text-right tabular">
                  {r.provider_count > 0 ? r.provider_count : '—'}
                </td>
                <td className="py-2.5 px-3 text-right tabular text-muted-foreground">
                  {r.provider_count > 0 && population > 0 ? r.per_10k.toFixed(2) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right tabular text-muted-foreground">
                  {r.provider_count > 0 ? `${share.toFixed(0)}%` : '—'}
                </td>
              </tr>
            );
          })}
          <tr className="border-t font-medium">
            <td className="py-2.5 px-3">Total</td>
            <td className="py-2.5 px-3 text-right tabular">{totalProviders}</td>
            <td className="py-2.5 px-3 text-right tabular">
              {((totalProviders / population) * 10000).toFixed(2)}
            </td>
            <td className="py-2.5 px-3 text-right tabular text-muted-foreground">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
