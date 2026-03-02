import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  return NextResponse.json({
    authenticated: !!session?.user,
    session: session ? {
      userId: session.user?.id,
      name: session.user?.name,
      email: session.user?.email,
    } : null,
    env: {
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
      hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
    },
  });
}
