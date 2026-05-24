import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  const sp = await searchParams;
  if (user && !sp.reason) {
    redirect(sp.next && sp.next.startsWith('/') ? sp.next : '/');
  }
  return (
    <div className="mx-auto max-w-content px-6 py-16">
      <div className="grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Gulf South Center — Hackathon Round 2
          </p>
          <h1 className="font-display headline text-6xl md:text-7xl mt-4 leading-[1.02]">
            EGI Workbench
          </h1>
          <p className="mt-6 text-xl text-foreground/80 max-w-xl leading-snug">
            A research decision-support tool built on the Mississippi Health Equity Gap Index.
          </p>
          <details className="mt-12 text-sm text-muted-foreground max-w-xl">
            <summary className="cursor-pointer hover:text-foreground transition-colors">
              About this demo
            </summary>
            <p className="mt-3 leading-relaxed">
              Three seeded users illustrate the role-based access model. In a production
              deployment this would integrate with the Center&apos;s institutional SSO.
            </p>
          </details>

          {/* Editorial data callout — fills the lower-left space and surfaces the
              headline finding before the user logs in. */}
          <div className="mt-12 pt-8 border-t border-rule">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-10">
              The index, in three numbers
            </p>

            <div className="space-y-10 max-w-xl">
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 md:items-baseline">
                <p className="font-display text-7xl font-medium leading-none tracking-tight text-accent tabular">
                  82
                </p>
                <p className="text-sm text-foreground/75 leading-snug max-w-xs">
                  Mississippi counties — every one ranked on a single composite
                  built from three independent federal datasets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 md:items-baseline">
                <p className="font-display text-7xl font-medium leading-none tracking-tight text-accent tabular">
                  #1
                </p>
                <p className="text-sm text-foreground/75 leading-snug max-w-xs">
                  <span className="font-medium text-foreground">Issaquena</span> — the most
                  underserved county, independently corroborated by federal HRSA Health
                  Professional Shortage Area designation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 md:items-baseline">
                <p className="font-display text-7xl font-medium leading-none tracking-tight text-accent tabular">
                  3
                </p>
                <p className="text-sm text-foreground/75 leading-snug max-w-xs">
                  federal datasets — CDC PLACES (disease burden), CMS NPPES (provider
                  capacity), CDC/ATSDR SVI (social vulnerability) — each vintage-locked
                  and reproducibly loaded.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="border p-8 bg-card">
            <h2 className="font-display text-2xl">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a role below or enter credentials manually.
            </p>
            {sp.reason === 'forbidden' ? (
              <div className="mt-4 text-sm border-l-2 border-accent pl-3 py-2 text-foreground bg-accent/5">
                That action requires elevated permissions. Sign in as a Methodology Steward to
                continue.
              </div>
            ) : null}
            <LoginForm next={sp.next} />
          </div>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Demo password for all three accounts: <code className="font-mono">demo</code>
          </div>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t flex flex-wrap gap-6 text-xs text-muted-foreground">
        <Link href="/methodology" className="hover:text-foreground">
          Methodology
        </Link>
        <a
          href="https://github.com/yarwen0/hackathon"
          className="hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          Round 1 source
        </a>
        <a
          href="https://www.cdc.gov/places/index.html"
          className="hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          CDC PLACES
        </a>
        <a
          href="https://www.atsdr.cdc.gov/place-health/php/svi/index.html"
          className="hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          CDC/ATSDR SVI
        </a>
      </div>
    </div>
  );
}
