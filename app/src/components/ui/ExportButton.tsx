'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

interface Props {
  href: string;
  label?: string;
  filename?: string;
}

export function ExportButton({ href, label = 'Export CSV', filename }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href={href}
      download={filename}
      onClick={() => {
        setBusy(true);
        setTimeout(() => setBusy(false), 1000);
      }}
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground border px-3 py-1.5 transition-colors"
    >
      <Download size={12} aria-hidden />
      {busy ? 'Preparing…' : label}
    </a>
  );
}
