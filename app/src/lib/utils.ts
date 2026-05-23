import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat('en-US', opts).format(n);
}

export function formatInt(n: number): string {
  return formatNumber(n, { maximumFractionDigits: 0 });
}

export function formatScore(n: number, decimals = 1): string {
  return formatNumber(n, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(n: number, decimals = 1): string {
  return `${formatScore(n, decimals)}%`;
}

export function formatRank(rank: number): string {
  if (rank === 1) return '#1';
  return `#${formatInt(rank)}`;
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Linear interpolation between green→yellow→red for the EGI map.
export function egiColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100));
  // 0   → green (#1d6e3a)   29,110,58
  // 0.5 → yellow (#e6c84d) 230,200,77
  // 1   → red (#8b1e1e)    139,30,30
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const k = t / 0.5;
    r = Math.round(29 + (230 - 29) * k);
    g = Math.round(110 + (200 - 110) * k);
    b = Math.round(58 + (77 - 58) * k);
  } else {
    const k = (t - 0.5) / 0.5;
    r = Math.round(230 + (139 - 230) * k);
    g = Math.round(200 + (30 - 200) * k);
    b = Math.round(77 + (30 - 77) * k);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function quintileColor(quintile: number): string {
  // 1 = most underserved (red) … 5 = least (green)
  const map: Record<number, string> = {
    1: '#8b1e1e',
    2: '#c25d2e',
    3: '#e6c84d',
    4: '#79a655',
    5: '#1d6e3a',
  };
  return map[quintile] ?? '#6b6258';
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
