import { quintileColor } from '@/lib/utils';

interface Props {
  quintile: number;
  size?: 'sm' | 'md';
}

const LABELS: Record<number, string> = {
  1: 'Most',
  2: 'High',
  3: 'Mid',
  4: 'Low',
  5: 'Least',
};

export function QuintileBadge({ quintile, size = 'sm' }: Props) {
  const color = quintileColor(quintile);
  return (
    <span
      className={
        size === 'sm'
          ? 'inline-flex items-center gap-1.5 text-2xs'
          : 'inline-flex items-center gap-2 text-xs'
      }
      title={`Quintile ${quintile} — ${LABELS[quintile] ?? ''} underserved`}
    >
      <span
        aria-hidden
        className={size === 'sm' ? 'w-2 h-2 rounded-full' : 'w-2.5 h-2.5 rounded-full'}
        style={{ background: color }}
      />
      <span className="uppercase tracking-wider text-muted-foreground">Q{quintile}</span>
    </span>
  );
}
