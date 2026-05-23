import type { CountyBurdenDriver } from '@/lib/types';

interface Props {
  drivers: CountyBurdenDriver[];
  limit?: number;
}

export function BurdenDriversTable({ drivers, limit = 5 }: Props) {
  const positive = drivers.filter((d) => d.deviation > 0).slice(0, limit);
  if (positive.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No burden measure exceeds the state mean.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs uppercase tracking-wider text-muted-foreground border-b">
            <th scope="col" className="py-2 px-3 text-left font-medium">
              Measure
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              County
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              State mean
            </th>
            <th scope="col" className="py-2 px-3 text-right font-medium">
              Δ
            </th>
            <th scope="col" className="py-2 px-3 text-left font-medium">
              Vintage
            </th>
          </tr>
        </thead>
        <tbody>
          {positive.map((d) => (
            <tr key={d.measure_id} className="border-b last:border-b-0">
              <td className="py-2.5 px-3">
                <div>{d.measure_short}</div>
                <div className="text-2xs text-muted-foreground mt-0.5">{d.category}</div>
              </td>
              <td className="py-2.5 px-3 text-right tabular">{d.value.toFixed(1)}%</td>
              <td className="py-2.5 px-3 text-right tabular text-muted-foreground">
                {d.state_mean.toFixed(1)}%
              </td>
              <td className="py-2.5 px-3 text-right tabular text-accent">
                +{Math.abs(d.deviation).toFixed(1)}
              </td>
              <td className="py-2.5 px-3 text-2xs uppercase tracking-wider text-muted-foreground">
                BRFSS {d.year}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {drivers.length > positive.length ? (
        <div className="mt-2 text-2xs text-muted-foreground italic">
          {drivers.length - positive.length} additional burden measures are at or below state mean.
        </div>
      ) : null}
    </div>
  );
}
