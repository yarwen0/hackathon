import { egiColor } from '@/lib/utils';

interface Props {
  value: number;
  max?: number;
  stateMean?: number;
  color?: 'foreground' | 'accent' | 'gradient';
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function Bar({
  value,
  max = 100,
  stateMean,
  color = 'foreground',
  label,
  showValue = true,
  className,
}: Props) {
  const safeValue = Math.max(0, Math.min(value, max));
  const pct = (safeValue / max) * 100;
  const meanPct = stateMean !== undefined ? (Math.max(0, Math.min(stateMean, max)) / max) * 100 : null;
  const fillStyle =
    color === 'gradient'
      ? { background: egiColor(value) }
      : color === 'accent'
      ? { background: 'var(--accent)' }
      : { background: 'var(--foreground)' };
  return (
    <div className={className}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between mb-1.5">
          {label ? <div className="text-xs text-muted-foreground">{label}</div> : null}
          {showValue ? <div className="text-xs tabular">{value.toFixed(1)}</div> : null}
        </div>
      ) : null}
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, ...fillStyle }} />
        {meanPct !== null ? (
          <div
            className="bar-state-line"
            style={{ left: `${meanPct}%` }}
            title={`State mean: ${stateMean!.toFixed(1)}`}
          />
        ) : null}
      </div>
    </div>
  );
}
