import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkQuota } from '@/lib/quota';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const quota = await checkQuota(session.user.id);
  return NextResponse.json({ quota });
}
