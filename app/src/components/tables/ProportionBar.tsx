interface Props {
  a: number | null;
  b: number | null;
  labelA?: string;
  labelB?: string;
}

// 100% wide bar split into two segments by the ratio a / (a + b).
// A's segment uses var(--foreground); B's uses var(--accent).
// Renders a gray track when both values are zero or null.
export function ProportionBar({ a, b, labelA, labelB }: Props) {
  const aVal = Math.abs(a ?? 0);
  const bVal = Math.abs(b ?? 0);
  const total = aVal + bVal;
  if (total === 0) {
    return <div className="h-1.5 w-full bg-muted" aria-hidden />;
  }
  const aPct = (aVal / total) * 100;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden bg-muted"
      role="img"
      aria-label={
        labelA && labelB
          ? `${labelA}: ${aPct.toFixed(0)}% of combined value, ${labelB}: ${(100 - aPct).toFixed(0)}%`
          : `Proportion: ${aPct.toFixed(0)}% A, ${(100 - aPct).toFixed(0)}% B`
      }
    >
      <div
        style={{ width: `${aPct}%`, background: 'var(--foreground)' }}
        title={labelA ? `${labelA}: ${aVal.toFixed(1)}` : undefined}
      />
      <div
        style={{ width: `${100 - aPct}%`, background: 'var(--accent)' }}
        title={labelB ? `${labelB}: ${bVal.toFixed(1)}` : undefined}
      />
    </div>
  );
}
