import { renderToBuffer } from '@react-pdf/renderer';
import { requireAuth } from '@/lib/auth';
import { getCounty, getDataSources } from '@/lib/data';
import { CountyReport } from '@/components/pdf/CountyReport';
import { createElement } from 'react';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ fips: string }> }) {
  await requireAuth();
  const { fips } = await params;
  const [county, dataSources] = await Promise.all([getCounty(fips), getDataSources()]);
  if (!county) return new Response('County not found', { status: 404 });
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const element = createElement(CountyReport, { county, dataSources, generatedAt });
  // @ts-expect-error react-pdf typings don't expose Document children narrowing
  const buffer = await renderToBuffer(element);
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="egi-county-${county.county.county_name.replace(/\s/g, '-')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
