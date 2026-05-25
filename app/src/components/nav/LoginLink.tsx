'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function LoginLink() {
  const pathname = usePathname();
  if (pathname === '/login') return null;
  return (
    <Link
      href="/login"
      className="text-xs uppercase tracking-wider text-foreground hover:text-accent transition-colors px-2 py-1"
    >
      Log in
    </Link>
  );
}
