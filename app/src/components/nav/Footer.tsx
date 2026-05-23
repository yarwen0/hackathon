import Link from 'next/link';

export function Footer() {
  return (
    <footer className="no-print mt-24 border-t">
      <div className="mx-auto max-w-content px-6 py-10 grid gap-8 md:grid-cols-3 text-sm text-muted-foreground">
        <div>
          <div className="font-display text-lg text-foreground">EGI Workbench</div>
          <p className="mt-2 max-w-prose leading-relaxed">
            A research decision-support tool built on the Mississippi Health Equity Gap Index for
            the Gulf South Center for Community-Engaged Health Research and Innovation.
          </p>
        </div>
        <div>
          <div className="text-foreground uppercase tracking-wider text-xs mb-3">Data sources</div>
          <ul className="space-y-1.5">
            <li>CDC PLACES — chronic disease burden</li>
            <li>CDC/ATSDR SVI — social vulnerability</li>
            <li>CMS NPPES + Census ACS — provider capacity</li>
            <li>US Census ZCTA crosswalk — geocoding</li>
          </ul>
        </div>
        <div>
          <div className="text-foreground uppercase tracking-wider text-xs mb-3">References</div>
          <ul className="space-y-1.5">
            <li>
              <Link href="/methodology" className="hover:text-foreground transition-colors">
                Methodology &amp; decision log
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/yarwen0/hackathon"
                className="hover:text-foreground transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Round 1 source &amp; data pipeline
              </a>
            </li>
            <li>
              <a
                href="https://msdelta.gov/"
                className="hover:text-foreground transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mississippi Delta Regional Authority
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-content px-6 pb-6 text-xs text-muted-foreground border-t pt-4">
        Gulf South Center Hackathon Round 2 · Built {new Date().getFullYear()} · No PHI ingested.
      </div>
    </footer>
  );
}
