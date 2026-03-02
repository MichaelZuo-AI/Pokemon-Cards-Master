export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - /login
     * - /api/auth/* (NextAuth routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /manifest.json, /sw.js, /icons/* (static PWA files)
     */
    '/((?!login|api/auth|_next|favicon\\.ico|manifest\\.json|sw\\.js|icons).*)',
  ],
};
