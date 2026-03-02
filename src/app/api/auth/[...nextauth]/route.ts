import { handlers } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

// Vercel strips Next.js basePath from request.url, but Auth.js compares
// request.url against AUTH_URL (which includes basePath) to match routes.
// Re-add basePath so Auth.js can parse the request correctly.
function patchUrl(req: NextRequest): NextRequest {
  if (!BASE_PATH) return req;
  const url = new URL(req.url);
  if (!url.pathname.startsWith(BASE_PATH)) {
    return new NextRequest(
      `${url.origin}${BASE_PATH}${url.pathname}${url.search}`,
      { method: req.method, headers: req.headers, body: req.body },
    );
  }
  return req;
}

export async function GET(req: NextRequest) {
  return handlers.GET(patchUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(patchUrl(req));
}
