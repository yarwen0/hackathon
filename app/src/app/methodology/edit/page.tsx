import Link from 'next/link';
import { getCurrentUser, requireAuth } from '@/lib/auth';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MethodologyEditPage() {
  await requireAuth();
  const user = await getCurrentUser();
  if (!user || user.role !== 'methodology_steward') {
    return (
      <div className="mx-auto max-w-content px-6 py-16">
        <Link href="/methodology" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft size={11} aria-hidden /> Methodology
        </Link>
        <div className="mt-8 border-l-2 border-accent pl-5 py-2 max-w-prose">
          <div className="text-xs uppercase tracking-wider text-accent">
            Restricted to Methodology Steward
          </div>
          <h1 className="font-display text-3xl mt-2">Edit access required</h1>
          <p className="mt-3 text-muted-foreground">
            This view is reserved for users whose role can govern the methodology itself —
            editing data-source descriptions and decision rationales. Methodology stewards
            modify the documented record so officers and external collaborators can trust what
            they see.
          </p>
          <p className="mt-3 text-muted-foreground">
            You&apos;re signed in as <code className="font-mono">{user?.email ?? 'unknown'}</code>{' '}
            ({user?.role.replace('_', ' ') ?? 'no role'}). Sign in as the steward demo account to
            access this view.
          </p>
          <Link
            href="/login?reason=forbidden"
            className="mt-5 inline-block border border-foreground px-4 py-2 text-xs uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
          >
            Switch role
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-6 py-10 animate-fade-in">
      <Link href="/methodology" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft size={11} aria-hidden /> Methodology
      </Link>
      <header className="mt-4 pb-6 border-b">
        <div className="text-xs uppercase tracking-[0.18em] text-accent">Steward · edit</div>
        <h1 className="font-display text-4xl mt-2">Edit methodology metadata</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          This view exposes the editable surfaces a methodology steward would manage in
          production — data source descriptions, decision rationales, and the
          official/experimental flag on alternative weightings. In this demo the edits are
          recorded as ephemeral KV writes and aren&apos;t persisted to the source-of-truth
          DECISIONS.md.
        </p>
      </header>

      <div className="mt-10 grid gap-8">
        <Section title="Decision rationale">
          <textarea
            defaultValue="D-016: equal thirds. Matches County Health Rankings precedent, declines to model unknown stakeholder weights, single CTE for tunability."
            className="w-full bg-background border px-3 py-2.5 text-sm h-32 font-mono"
          />
        </Section>
        <Section title="Source description — CDC PLACES 2025">
          <textarea
            defaultValue="2025 release of CDC PLACES county-level chronic disease prevalences. Long-form (one row per county × measure × year × value type). 4 measures still on 2022 BRFSS pending updated estimates."
            className="w-full bg-background border px-3 py-2.5 text-sm h-24 font-mono"
          />
        </Section>
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="button"
            disabled
            className="border border-foreground px-4 py-2 text-xs uppercase tracking-wider opacity-40 cursor-not-allowed"
            title="Demo: edits aren't persisted to DECISIONS.md in this hackathon build."
          >
            Save (demo · not persisted)
          </button>
          <span className="text-xs text-muted-foreground">
            Production would write to a methodology-overrides table and update DECISIONS.md via PR.
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      {children}
    </div>
  );
}
