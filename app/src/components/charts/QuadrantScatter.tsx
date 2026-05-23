'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CartesianGrid,
  Customized,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { QuadrantPoint, Region } from '@/lib/types';

interface Props {
  points: QuadrantPoint[];
  stateMeans: { burden: number; vulnerability: number };
  selectedRegions: Set<Region> | null;
}

interface PlottedPoint extends QuadrantPoint {
  color: string;
  dimmed: boolean;
  needsLabel: boolean;
}

const MIN_R = 5;
const MAX_R = 14;
const OFF_DIAG_MULT = 1.25;

// Hand-tuned label offsets for counties whose circles + neighbours collide
// when labels render in a default position. Anchor matches CSS textAnchor.
// Coordinates are deltas from the circle center.
const MANUAL_LABEL_OFFSETS: Record<
  string,
  { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }
> = {
  // Pine Belt cluster.
  Hinds: { dx: -12, dy: -22, anchor: 'end' }, // above-left
  Forrest: { dx: 18, dy: -4, anchor: 'start' }, // close to its own circle, just right
  Harrison: { dx: 0, dy: 34, anchor: 'middle' }, // clearly below the circle
  Lauderdale: { dx: 0, dy: -22, anchor: 'middle' }, // directly on top of its circle
  // Bottom-left pair: both labels sit directly on top of their own circle.
  DeSoto: { dx: 0, dy: -22, anchor: 'middle' }, // on top, centered
  Rankin: { dx: 0, dy: -22, anchor: 'middle' }, // on top, centered
  // Lower-right off-diagonal pair: split vertically off the right edge.
  Smith: { dx: 14, dy: -10, anchor: 'start' }, // upper-right of circle
  Yalobusha: { dx: 14, dy: 14, anchor: 'start' }, // lower-right of circle
};

// Muted earth-tone capacity ramp. Reads as a research publication, not a
// traffic-light warning dashboard.
function capacityColor(capacity: number): string {
  if (capacity < 33) return '#7a8c5a'; // muted olive — good capacity
  if (capacity < 66) return '#c89a4a'; // muted ochre — middling
  return '#a64a2e'; // muted terracotta — worst (most scarce)
}

export function QuadrantScatter({ points, stateMeans, selectedRegions }: Props) {
  const router = useRouter();

  const { regular, offDiag, annotationTarget, pointRadius } = useMemo(() => {
    const populations = points.map((p) => p.population).filter(Boolean);
    const sqrtMin = Math.sqrt(Math.min(...populations));
    const sqrtMax = Math.sqrt(Math.max(...populations));
    const denom = Math.max(sqrtMax - sqrtMin, 1e-9);
    const pointRadius = (pop: number): number => {
      const t = (Math.sqrt(pop) - sqrtMin) / denom;
      return MIN_R + t * (MAX_R - MIN_R);
    };

    // Top-4 by population — these get labels because their circles are large
    // enough that side labels disappear under them.
    const topFour = new Set(
      [...points].sort((a, b) => b.population - a.population).slice(0, 4).map((p) => p.fips),
    );

    const regular: PlottedPoint[] = [];
    const offDiag: PlottedPoint[] = [];
    for (const p of points) {
      const dimmed = Boolean(
        selectedRegions && selectedRegions.size > 0 && !selectedRegions.has(p.region),
      );
      const entry: PlottedPoint = {
        ...p,
        color: capacityColor(p.capacity),
        dimmed,
        needsLabel: !dimmed && (p.isOffDiagonal || topFour.has(p.fips)),
      };
      (p.isOffDiagonal ? offDiag : regular).push(entry);
    }
    // Annotation target: most-extreme lower-right outlier (high burden, low vulnerability).
    const annotationTarget =
      points
        .filter((p) => p.burden > stateMeans.burden && p.vulnerability < stateMeans.vulnerability)
        .map((p) => ({
          point: p,
          delta:
            (p.burden - stateMeans.burden) +
            (stateMeans.vulnerability - p.vulnerability),
        }))
        .sort((a, b) => b.delta - a.delta)[0]?.point ?? null;
    return { regular, offDiag, annotationTarget, pointRadius };
  }, [points, selectedRegions, stateMeans]);

  return (
    <div
      className="w-full h-[520px]"
      aria-label="Burden vs vulnerability scatter — off-diagonal counties outlined and labeled"
    >
      <span className="sr-only">
        {offDiag.length} counties sit off the burden-vulnerability diagonal: {offDiag.map((p) => p.county_name).join(', ')}.
      </span>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 30, right: 60, bottom: 80, left: 60 }}>
          <CartesianGrid
            stroke="var(--rule)"
            strokeOpacity={0.4}
            strokeDasharray="0"
            vertical={false}
            horizontal={true}
          />
          <XAxis
            type="number"
            dataKey="burden"
            domain={[-5, 105]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tick={{
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
            }}
            label={{
              value: 'BURDEN COMPONENT →',
              position: 'insideBottom',
              offset: -12,
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
            }}
          />
          <YAxis
            type="number"
            dataKey="vulnerability"
            domain={[-5, 105]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tick={{
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
            }}
            label={{
              value: 'VULNERABILITY COMPONENT →',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-plex-mono), ui-monospace, monospace',
            }}
          />
          <ReferenceLine
            x={stateMeans.burden}
            stroke="var(--foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.35}
            label={{
              value: 'State mean burden',
              position: 'top',
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-plex-sans), system-ui, sans-serif',
            }}
          />
          <ReferenceLine
            y={stateMeans.vulnerability}
            stroke="var(--foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.35}
            label={{
              value: 'State mean vulnerability',
              position: 'insideTopRight',
              fill: 'var(--muted-foreground)',
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-plex-sans), system-ui, sans-serif',
            }}
          />
          <Tooltip
            content={<CountyTooltip />}
            cursor={false}
            wrapperStyle={{ pointerEvents: 'none', outline: 'none', zIndex: 50 }}
            allowEscapeViewBox={{ x: false, y: false }}
            offset={12}
          />
          {/* Regular points underneath — de-emphasized */}
          <Scatter
            data={regular}
            shape={(props: unknown) => (
              <PointShape {...(props as ShapeProps)} radiusFor={pointRadius} />
            )}
            onClick={(d: { fips?: string }) => {
              if (d?.fips) router.push(`/county/${d.fips}`);
            }}
          />
          {/* Off-diagonal points on top — emphasized */}
          <Scatter
            data={offDiag}
            shape={(props: unknown) => (
              <PointShape {...(props as ShapeProps)} radiusFor={pointRadius} />
            )}
            onClick={(d: { fips?: string }) => {
              if (d?.fips) router.push(`/county/${d.fips}`);
            }}
          />
          {/* Editorial annotation: short straight arrow + italic Fraunces callout
              pointing at the most-off-diagonal lower-right county. */}
          {annotationTarget ? (
            <Customized
              component={(chartProps: unknown) => (
                <AnnotationLayer
                  chartProps={chartProps}
                  target={annotationTarget}
                  radiusFor={pointRadius}
                />
              )}
            />
          ) : null}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ShapeProps {
  cx?: number;
  cy?: number;
  payload?: PlottedPoint;
  radiusFor: (pop: number) => number;
}

function PointShape({ cx, cy, payload, radiusFor }: ShapeProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const base = radiusFor(payload.population);
  const r = payload.isOffDiagonal ? base * OFF_DIAG_MULT : base;
  const off = payload.isOffDiagonal;
  const dim = payload.dimmed;
  const shortName = payload.county_name.replace(' County', '');
  // Three positioning rules for the label, in priority order:
  //   1. If the county has a manual offset entry, use that exact placement.
  //   2. Else if off-diagonal, render to the right of the circle's edge + 6px.
  //   3. Else (a labeled top-4 county with no manual entry) fall back to below.
  let labelPos: { x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null = null;
  if (payload.needsLabel) {
    const manual = MANUAL_LABEL_OFFSETS[shortName];
    if (manual) {
      labelPos = { x: cx + manual.dx, y: cy + manual.dy, anchor: manual.anchor };
    } else if (off) {
      labelPos = { x: cx + r + 6, y: cy + 4, anchor: 'start' };
    } else {
      labelPos = { x: cx, y: cy + r + 12, anchor: 'middle' };
    }
  }
  return (
    <g style={{ pointerEvents: 'all', cursor: 'pointer' }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={payload.color}
        fillOpacity={dim ? 0.12 : off ? 0.95 : 0.55}
        stroke="var(--foreground)"
        strokeWidth={off ? 1.5 : 0.5}
        strokeOpacity={dim ? 0.15 : off ? 1 : 0.3}
      />
      {labelPos ? (
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor={labelPos.anchor}
          fontSize={11}
          fontFamily="var(--font-plex-mono), ui-monospace, monospace"
          fill="var(--foreground)"
          fillOpacity={0.9}
          style={{ pointerEvents: 'none' }}
        >
          {shortName}
        </text>
      ) : null}
    </g>
  );
}

interface ChartProps {
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  width?: number;
  height?: number;
}

function AnnotationLayer({
  chartProps,
  target,
  radiusFor,
}: {
  chartProps: unknown;
  target: QuadrantPoint;
  radiusFor: (pop: number) => number;
}) {
  const c = chartProps as ChartProps;
  const xAxis = c.xAxisMap ? Object.values(c.xAxisMap)[0] : null;
  const yAxis = c.yAxisMap ? Object.values(c.yAxisMap)[0] : null;
  if (!xAxis || !yAxis) return null;
  const cx = xAxis.scale(target.burden);
  const cy = yAxis.scale(target.vulnerability);
  const pointR = radiusFor(target.population) * OFF_DIAG_MULT;

  // Anchor the callout to the empty lower band of the chart: text top sits at
  // the vulnerability=20 line so the three-line block falls inside the
  // ~0–20 vulnerability range, well below the rest of the labeled points.
  const w = c.width ?? 600;
  const v20Y = yAxis.scale(20);
  const annotationBlockHeight = 50; // ~3 lines of italic text
  const labelX = Math.min(cx + 80, w - 220);
  const labelY = v20Y;

  // Connector: roughly horizontal line from text's left-middle back to the
  // right edge of Franklin's circle. The arrowhead orientation is auto-
  // computed below from the line direction, so it always points at the data
  // point regardless of whether the text ended up above or below.
  const lineStartX = labelX - 8;
  const lineStartY = labelY + annotationBlockHeight / 2;
  const lineEndX = cx + pointR + 2;
  const lineEndY = cy + 2;
  // Arrowhead apex points at the endpoint, rotated by the line direction.
  // Three-point triangle: small, foreground-colored, half-opacity.
  const arrowSize = 5;
  const dx = lineEndX - lineStartX;
  const dy = lineEndY - lineStartY;
  const len = Math.max(Math.hypot(dx, dy), 1e-6);
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular for the triangle base.
  const px = -uy;
  const py = ux;
  const arrowApex = `${lineEndX},${lineEndY}`;
  const arrowBaseA = `${lineEndX - ux * arrowSize - px * (arrowSize * 0.6)},${lineEndY - uy * arrowSize - py * (arrowSize * 0.6)}`;
  const arrowBaseB = `${lineEndX - ux * arrowSize + px * (arrowSize * 0.6)},${lineEndY - uy * arrowSize + py * (arrowSize * 0.6)}`;
  const name = target.county_name.replace(' County', '');

  return (
    <g style={{ pointerEvents: 'none' }}>
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={lineEndX}
        y2={lineEndY}
        stroke="var(--foreground)"
        strokeWidth={1}
        strokeOpacity={0.5}
      />
      <polygon
        points={`${arrowApex} ${arrowBaseA} ${arrowBaseB}`}
        fill="var(--foreground)"
        fillOpacity={0.5}
      />
      <text
        x={labelX}
        y={labelY}
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontStyle="italic"
        fontSize={13}
        fill="var(--foreground)"
      >
        <tspan x={labelX} dy={0} fontWeight={500}>
          {name}.
        </tspan>
        <tspan x={labelX} dy={18} fill="var(--muted-foreground)" fontStyle="italic">
          Higher burden than peers,
        </tspan>
        <tspan x={labelX} dy={15} fill="var(--muted-foreground)" fontStyle="italic">
          lower vulnerability — atypical.
        </tspan>
      </text>
    </g>
  );
}

function CountyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: QuadrantPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-card border border-rule-strong shadow-lg p-3 text-xs">
      <div className="font-display text-base">
        {p.county_name.replace(' County', '')}
        {p.isOffDiagonal ? (
          <span className="ml-2 text-2xs uppercase tracking-wider text-accent">off-diagonal</span>
        ) : null}
      </div>
      <div className="text-muted-foreground">{p.region} · pop {Intl.NumberFormat('en-US').format(p.population)}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 tabular">
        <div>EGI</div><div className="text-right font-mono">{p.egi.toFixed(1)}</div>
        <div>Burden</div><div className="text-right font-mono">{p.burden.toFixed(1)}</div>
        <div>Vulnerability</div><div className="text-right font-mono">{p.vulnerability.toFixed(1)}</div>
        <div>Capacity</div><div className="text-right font-mono">{p.capacity.toFixed(1)}</div>
      </div>
      <div className="mt-2 text-2xs uppercase tracking-wider text-muted-foreground">
        Click to drill in
      </div>
    </div>
  );
}
