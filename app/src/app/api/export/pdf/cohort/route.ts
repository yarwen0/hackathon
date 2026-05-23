import { renderToBuffer } from '@react-pdf/renderer';
import { requireAuth } from '@/lib/auth';
import { getCohort, getDataSources } from '@/lib/data';
import { parseCohortCriteria } from '@/lib/filters';
import { CohortReport } from '@/components/pdf/CohortReport';
import { createElement } from 'react';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  const user = await requireAuth();
  const url = new URL(req.url);
  const criteria = parseCohortCriteria(url.searchParams);
  const [cohort, dataSources] = await Promise.all([getCohort(criteria), getDataSources()]);
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const element = createElement(CohortReport, {
    cohort,
    dataSources,
    generatedAt,
    generatedBy: user.role !== 'external_collaborator' ? user.displayName : undefined,
    generatedByEmail: user.email,
  });
  // @ts-expect-error react-pdf typings don't expose Document children narrowing
  const buffer = await renderToBuffer(element);
  // Copy into a fresh ArrayBuffer-backed Uint8Array so TypeScript's strict
  // BodyInit/BlobPart definitions accept it (Buffer's underlying buffer is
  // typed as ArrayBufferLike which could be SharedArrayBuffer).
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="egi-cohort-${cohort.rows.length}-counties.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
