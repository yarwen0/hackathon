'use client';

import dynamic from 'next/dynamic';
import type { CountyRow } from '@/lib/types';

const Inner = dynamic(() => import('./ChoroplethInner'), {
  ssr: false,
  loading: () => (
    <div className="aspect-square md:aspect-auto md:h-full bg-muted/40 border flex items-center justify-center text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface Props {
  rows: CountyRow[];
  colorBy?: 'egi_score' | 'burden_component' | 'capacity_component' | 'vulnerability_component';
  highlightFips?: string | null;
  onHover?: (fips: string | null) => void;
  height?: number | string;
  // 'full' = OSM basemap + colored counties + gradient legend.
  // 'shapes' = no basemap, no legend; only county shapes on the page background,
  // with non-cohort counties faded so cohort counties pop. Use for mini-maps.
  mode?: 'full' | 'shapes';
}

export function ChoroplethMap(props: Props) {
  return <Inner {...props} />;
}
