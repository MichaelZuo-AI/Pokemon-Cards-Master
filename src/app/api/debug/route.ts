import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    requestUrl: request.url,
    pathname: request.nextUrl.pathname,
    basePath: request.nextUrl.basePath,
    authUrl: process.env.AUTH_URL || '(not set)',
    env: {
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
      hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
    },
  });
}
