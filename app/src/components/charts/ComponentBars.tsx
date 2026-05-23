import { AuditTooltip } from '@/components/ui/AuditTooltip';
import { Bar } from '@/components/ui/Bar';

interface Props {
  burden: number;
  capacity: number;
  vulnerability: number;
  stateMeans: { burden: number; capacity: number; vulnerability: number };
}

export function ComponentBars({ burden, capacity, vulnerability, stateMeans }: Props) {
  const items = [
    {
      label: 'Burden',
      audit: 'burden_component',
      value: burden,
      mean: stateMeans.burden,
      caption: 'PLACES — chronic disease + access',
    },
    {
      label: 'Capacity',
      audit: 'capacity_component',
      value: capacity,
      mean: stateMeans.capacity,
      caption: 'NPPES + ACS — primary-care scarcity',
    },
    {
      label: 'Vulnerability',
      audit: 'vulnerability_component',
      value: vulnerability,
      mean: stateMeans.vulnerability,
      caption: 'SVI — intra-MS social vulnerability',
    },
  ];
  return (
    <div className="grid gap-5">
      {items.map((it) => {
        const delta = it.value - it.mean;
        const sign = delta > 0 ? '+' : '';
        return (
          <div key={it.label}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm">
                <span className="font-medium">{it.label}</span>
                <AuditTooltip metricId={it.audit} className="ml-1" />
                <span className="block text-2xs uppercase tracking-wider text-muted-foreground mt-0.5">
                  {it.caption}
                </span>
              </div>
              <div className="text-right">
                <div className="font-mono tabular text-lg">{it.value.toFixed(1)}</div>
                <div
                  className={`text-2xs tabular ${
                    delta > 5 ? 'text-accent' : delta < -5 ? 'text-success' : 'text-muted-foreground'
                  }`}
                >
                  {sign}
                  {delta.toFixed(1)} vs state
                </div>
              </div>
            </div>
            <Bar value={it.value} stateMean={it.mean} color="gradient" showValue={false} />
          </div>
        );
      })}
    </div>
  );
}
