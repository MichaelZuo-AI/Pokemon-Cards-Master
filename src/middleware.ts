import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

export default auth((req) => {
  if (!req.auth) {
    const url = new URL(`${BASE_PATH}/login`, req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /_next/* (Next.js internals)
     * - /api/debug (debug endpoint)
     * - /favicon.ico, /manifest.webmanifest, /sw.js, /icons/* (static PWA files)
     */
    '/',
    '/((?!login|api/auth|api/debug|_next|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icons).*)',
  ],
};
