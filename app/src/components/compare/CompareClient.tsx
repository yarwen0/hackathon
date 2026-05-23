'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CountyPicker } from './CountyPicker';
import { ComparisonTable } from '@/components/tables/ComparisonTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExportButton } from '@/components/ui/ExportButton';
import type { CompareResponse } from '@/lib/types';

interface County {
  fips: string;
  county_name: string;
}

interface Props {
  counties: County[];
  initial: CompareResponse | null;
  initialA: string | null;
  initialB: string | null;
}

export function CompareClient({ counties, initial, initialA, initialB }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [a, setA] = useState<string | null>(initialA);
  const [b, setB] = useState<string | null>(initialB);
  const [data, setData] = useState<CompareResponse | null>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(sp.toString());
    if (a) next.set('a', a); else next.delete('a');
    if (b) next.set('b', b); else next.delete('b');
    const qs = next.toString();
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false });

    if (a && b) {
      const ctrl = new AbortController();
      setLoading(true);
      void fetch(`/api/compare?a=${a}&b=${b}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d as CompareResponse | null))
        .finally(() => setLoading(false));
      return () => ctrl.abort();
    }
    setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b]);

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <header className="border-b pb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Side-by-side</div>
        <h1 className="font-display headline text-5xl mt-2">Compare counties</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Pick any two of the eighty-two MS counties to see the EGI components, SVI themes,
          provider mix, and every burden measure laid out next to each other.
        </p>
      </header>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <CountyPicker counties={counties} value={a} onChange={setA} label="County A" />
        <CountyPicker counties={counties} value={b} onChange={setB} label="County B" accent="accent" />
      </div>

      <div className="mt-10">
        {!a || !b ? (
          <EmptyState
            title="Pick two counties to compare."
            description="Start with a county you've drilled into, then add a second to test whether the ranking matches your intuition."
          />
        ) : loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : !data ? (
          <EmptyState
            title="Couldn't load that comparison."
            description="One of the FIPS codes wasn't recognized."
          />
        ) : (
          <>
            <div className="flex items-center justify-end mb-4">
              <ExportButton href={`/api/export/csv/compare?a=${a}&b=${b}`} filename={`compare-${a}-${b}.csv`} />
            </div>
            <ComparisonTable data={data} />
          </>
        )}
      </div>
    </div>
  );
}
