// Edge-runtime middleware. Cookie presence is a coarse gate; the server-side
// route handler does the authoritative session lookup (KV is not reachable
// from middleware in a way that survives all runtimes cleanly).

import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/auth/login',
  '/api/auth/me',
  '/_next',
  '/favicon.ico',
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const p of PUBLIC_PATHS) {
    if (pathname.startsWith(p)) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  const cookie = req.cookies.get('egi_session');
  if (!cookie?.value) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect everything except static assets and public files.
    '/((?!_next/static|_next/image|_next/font|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.geojson$).*)',
  ],
};
