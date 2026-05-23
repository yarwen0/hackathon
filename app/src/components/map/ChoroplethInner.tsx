'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouter } from 'next/navigation';
import type { CountyRow } from '@/lib/types';
import { egiColor, formatInt, formatScore } from '@/lib/utils';

interface CountyProps {
  GEO_ID?: string;
  NAME?: string;
  STATE?: string;
  COUNTY?: string;
  LSAD?: string;
}

type CountyFeature = Feature<Geometry, CountyProps>;

interface Props {
  rows: CountyRow[];
  colorBy?: 'egi_score' | 'burden_component' | 'capacity_component' | 'vulnerability_component';
  highlightFips?: string | null;
  onHover?: (fips: string | null) => void;
  height?: number | string;
  mode?: 'full' | 'shapes';
}

export default function ChoroplethInner({
  rows,
  colorBy = 'egi_score',
  highlightFips,
  onHover,
  height,
  mode = 'full',
}: Props) {
  const router = useRouter();
  const [geo, setGeo] = useState<FeatureCollection<Geometry, CountyProps> | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/ms-counties.geojson')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setGeo(data as FeatureCollection<Geometry, CountyProps>);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const valueMap = useMemo(() => {
    const m = new Map<string, CountyRow>();
    for (const r of rows) m.set(r.fips, r);
    return m;
  }, [rows]);

  const visibleFips = useMemo(() => new Set(rows.map((r) => r.fips)), [rows]);

  // When the highlight changes, restyle the corresponding layer only.
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.eachLayer((layer) => {
      const f = (layer as L.Path & { feature?: CountyFeature }).feature;
      if (!f?.id) return;
      const fips = String(f.id);
      (layer as L.Path).setStyle(styleFor(fips, valueMap, colorBy, visibleFips, highlightFips, mode));
    });
  }, [highlightFips, valueMap, colorBy, visibleFips, mode]);

  const data = geo;
  const isShapesMode = mode === 'shapes';
  return (
    <div
      className={isShapesMode ? 'relative bg-background' : 'border bg-background relative'}
      style={{ height: height ?? '100%' }}
    >
      <MapContainer
        center={[32.7, -89.7]}
        zoom={7}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={!isShapesMode}
        style={{
          height: '100%',
          width: '100%',
          background: 'var(--background)',
        }}
      >
        {isShapesMode ? null : (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
        )}
        {data ? (
          <GeoJSON
            data={data}
            ref={(ref) => {
              layerRef.current = ref ?? null;
            }}
            style={(feature) => {
              const fips = feature?.id ? String(feature.id) : '';
              return styleFor(fips, valueMap, colorBy, visibleFips, highlightFips, mode);
            }}
            onEachFeature={(feature, layer) => {
              const fips = feature.id ? String(feature.id) : '';
              const row = valueMap.get(fips);
              if (row) {
                layer.bindTooltip(
                  `<strong>${row.county_name.replace(' County', '')}</strong><br/>` +
                    `<span style="color:#6b6258">rank ${row.egi_rank} · EGI ${formatScore(row.egi_score)}</span><br/>` +
                    `<span style="color:#6b6258">pop ${formatInt(row.population)} · ${row.region}</span>`,
                  { sticky: true, direction: 'top' },
                );
              }
              layer.on({
                mouseover: (e) => {
                  onHover?.(fips);
                  const target = e.target as L.Path;
                  target.setStyle({ weight: 2, color: '#1a1612' });
                  target.bringToFront();
                },
                mouseout: (e) => {
                  onHover?.(null);
                  (e.target as L.Path).setStyle(
                    styleFor(fips, valueMap, colorBy, visibleFips, highlightFips, mode),
                  );
                },
                click: () => {
                  if (row) router.push(`/county/${row.fips}`);
                },
              });
            }}
          />
        ) : null}
      </MapContainer>
      {isShapesMode ? null : (
        <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur border border-rule px-2 py-1.5 text-2xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 z-[400]">
          <span>Least underserved</span>
          <span
            className="flex-1 h-2"
            aria-hidden
            style={{
              background:
                'linear-gradient(to right, var(--map-low), var(--map-mid), var(--map-high))',
            }}
          />
          <span>Most</span>
        </div>
      )}
    </div>
  );
}

function styleFor(
  fips: string,
  valueMap: Map<string, CountyRow>,
  colorBy: 'egi_score' | 'burden_component' | 'capacity_component' | 'vulnerability_component',
  visible: Set<string>,
  highlight: string | null | undefined,
  mode: 'full' | 'shapes',
): L.PathOptions {
  const row = valueMap.get(fips);
  // Shapes-only mode (used for the cohort mini-map): non-cohort counties melt
  // into the page background with just a thin rule stroke, so cohort counties
  // pop.
  if (mode === 'shapes') {
    if (!row) {
      return {
        fillColor: '#fbf9f4',
        fillOpacity: 1,
        weight: 0.5,
        color: 'rgba(26,22,18,0.18)',
      };
    }
    const value = (row as unknown as Record<string, number>)[colorBy] ?? row.egi_score;
    return {
      fillColor: egiColor(value),
      fillOpacity: 0.92,
      weight: highlight === fips ? 2 : 0.8,
      color: highlight === fips ? '#1a1612' : '#fbf9f4',
      opacity: 1,
    };
  }
  if (!row) {
    return {
      fillColor: '#e9e4d8',
      fillOpacity: 0.4,
      weight: 0.5,
      color: '#cbc4b6',
    };
  }
  const dimmed = visible.size && !visible.has(fips);
  const value = (row as unknown as Record<string, number>)[colorBy] ?? row.egi_score;
  return {
    fillColor: egiColor(value),
    fillOpacity: dimmed ? 0.15 : 0.78,
    weight: highlight === fips ? 2.5 : 0.6,
    color: highlight === fips ? '#1a1612' : '#fbf9f4',
    opacity: dimmed ? 0.35 : 1,
  };
}
