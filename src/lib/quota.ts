export const DAILY_LIMIT = 1000;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

function getKSTDateString(): string {
  // en-CA locale gives YYYY-MM-DD format
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function makeKey(userId: string): string {
  return `quota:scan:${userId}:${getKSTDateString()}`;
}

// In-memory fallback for local dev (no KV_REST_API_URL)
const memoryStore = new Map<string, number>();

async function getKV() {
  if (!process.env.KV_REST_API_URL) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const key = makeKey(userId);
  const kvStore = await getKV();

  let used: number;
  if (kvStore) {
    used = (await kvStore.get<number>(key)) ?? 0;
  } else {
    used = memoryStore.get(key) ?? 0;
  }

  return {
    allowed: used < DAILY_LIMIT,
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
  };
}

export async function consumeQuota(userId: string): Promise<QuotaStatus> {
  const key = makeKey(userId);
  const kvStore = await getKV();

  let used: number;
  if (kvStore) {
    used = await kvStore.incr(key);
    // Set TTL to 48h on first increment (ensures cleanup even across date boundaries)
    if (used === 1) {
      await kvStore.expire(key, 48 * 60 * 60);
    }
  } else {
    used = (memoryStore.get(key) ?? 0) + 1;
    memoryStore.set(key, used);
  }

  return {
    allowed: used <= DAILY_LIMIT,
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
  };
}
