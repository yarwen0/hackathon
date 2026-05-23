'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface County {
  fips: string;
  county_name: string;
}

interface Props {
  counties: County[];
  value: string | null;
  onChange: (fips: string | null) => void;
  label: string;
  accent?: 'foreground' | 'accent';
}

export function CountyPicker({ counties, value, onChange, label, accent = 'foreground' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => counties.find((c) => c.fips === value) ?? null, [counties, value]);
  const filtered = useMemo(
    () => counties.filter((c) => c.county_name.toLowerCase().includes(query.toLowerCase())),
    [counties, query],
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [open]);

  const accentClass = accent === 'accent' ? 'text-accent' : 'text-foreground';

  return (
    <div ref={ref} className="relative w-full">
      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between border px-3 py-2.5 text-left text-base bg-background hover:border-foreground transition-colors ${accentClass}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-display text-xl">
          {selected ? selected.county_name.replace(' County', '') : 'Select a county…'}
        </span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full bg-card border shadow-lg max-h-72 overflow-hidden">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="w-full border-b bg-background px-3 py-2 text-sm font-mono focus:outline-none"
          />
          <ul className="max-h-60 overflow-y-auto" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground italic">No matches.</li>
            ) : (
              filtered.map((c) => (
                <li key={c.fips}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.fips);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${
                      value === c.fips ? 'bg-muted text-foreground' : ''
                    }`}
                  >
                    {c.county_name.replace(' County', '')}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
