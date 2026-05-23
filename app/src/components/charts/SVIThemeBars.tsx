import { AuditTooltip } from '@/components/ui/AuditTooltip';
import { Bar } from '@/components/ui/Bar';
import type { CountySVI } from '@/lib/types';

interface Props {
  svi: CountySVI;
}

const THEMES: Array<{ key: keyof CountySVI; label: string; short: string; audit: string }> = [
  { key: 'rpl_theme1_socioeconomic', label: 'Socioeconomic Status', short: 'Theme 1', audit: 'rpl_theme1_socioeconomic' },
  { key: 'rpl_theme2_household', label: 'Household Characteristics', short: 'Theme 2', audit: 'rpl_theme2_household' },
  { key: 'rpl_theme3_minority', label: 'Racial & Ethnic Minority Status', short: 'Theme 3', audit: 'rpl_theme3_minority' },
  { key: 'rpl_theme4_housing_transport', label: 'Housing Type & Transportation', short: 'Theme 4', audit: 'rpl_theme4_housing_transport' },
];

export function SVIThemeBars({ svi }: Props) {
  const dominant = svi.dominant_theme;
  return (
    <div className="grid gap-3.5">
      {svi.rpl_themes !== null ? (
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="text-sm font-medium">
              Overall SVI <AuditTooltip metricId="rpl_themes" className="ml-1" />
              <span className="block text-2xs uppercase tracking-wider text-muted-foreground mt-0.5">
                Intra-MS percentile
              </span>
            </div>
            <div className="font-mono tabular text-lg">{(svi.rpl_themes * 100).toFixed(0)}<span className="text-muted-foreground text-sm">th</span></div>
          </div>
          <Bar value={svi.rpl_themes * 100} color="accent" showValue={false} />
        </div>
      ) : null}
      <div className="grid gap-2 pt-2">
        {THEMES.map((t) => {
          const value = (svi[t.key] as number | null) ?? null;
          if (value === null) return null;
          const isDom = dominant.startsWith(t.label.split(' ')[0]!) ||
            (dominant === 'Socioeconomic Status' && t.key === 'rpl_theme1_socioeconomic') ||
            (dominant === 'Household Characteristics' && t.key === 'rpl_theme2_household') ||
            (dominant === 'Racial & Ethnic Minority Status' && t.key === 'rpl_theme3_minority') ||
            (dominant === 'Housing Type & Transportation' && t.key === 'rpl_theme4_housing_transport');
          return (
            <div key={t.key as string} className="grid grid-cols-[7rem_1fr_3rem_3rem] items-center gap-3 text-xs">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <span className="text-2xs uppercase tracking-wider">{t.short}</span>
                <AuditTooltip metricId={t.audit} />
              </div>
              <Bar value={value * 100} color={isDom ? 'accent' : 'foreground'} showValue={false} />
              <div className="text-right tabular">{(value * 100).toFixed(0)}</div>
              {isDom ? (
                <span className="text-2xs uppercase tracking-wider text-accent">Dominant</span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
