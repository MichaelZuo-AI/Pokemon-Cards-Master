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
    const patchedUrl = `${url.origin}${BASE_PATH}${url.pathname}${url.search}`;
    // Use standard Request clone pattern to preserve body, headers, cookies
    return new NextRequest(new Request(patchedUrl, req));
  }
  return req;
}

export async function GET(req: NextRequest) {
  return handlers.GET(patchUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(patchUrl(req));
}
