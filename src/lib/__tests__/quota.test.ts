/**
 * @jest-environment node
 */

// Mock @vercel/kv — must be set up before importing quota module
const mockGet = jest.fn();
const mockIncr = jest.fn();
const mockExpire = jest.fn();

jest.mock('@vercel/kv', () => ({
  kv: {
    get: mockGet,
    incr: mockIncr,
    expire: mockExpire,
  },
}));

import { checkQuota, consumeQuota } from '../quota';

describe('quota (in-memory fallback, no KV_REST_API_URL)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.KV_REST_API_URL;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('checkQuota returns allowed=true when no scans have been made', async () => {
    const result = await checkQuota('user-new');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(10);
  });

  it('consumeQuota increments usage', async () => {
    const r1 = await consumeQuota('user-incr');
    expect(r1.used).toBe(1);
    expect(r1.remaining).toBe(9);

    const r2 = await consumeQuota('user-incr');
    expect(r2.used).toBe(2);
    expect(r2.remaining).toBe(8);
  });

  it('checkQuota returns allowed=false after limit reached', async () => {
    for (let i = 0; i < 10; i++) {
      await consumeQuota('user-limit');
    }
    const result = await checkQuota('user-limit');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('different users have independent quotas', async () => {
    await consumeQuota('user-a');
    await consumeQuota('user-a');
    await consumeQuota('user-b');

    const a = await checkQuota('user-a');
    const b = await checkQuota('user-b');
    expect(a.used).toBe(2);
    expect(b.used).toBe(1);
  });
});

describe('quota (Vercel KV)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, KV_REST_API_URL: 'https://kv.example.com' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('checkQuota calls kv.get and returns status', async () => {
    mockGet.mockResolvedValue(3);

    const result = await checkQuota('user-kv');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(3);
    expect(result.remaining).toBe(7);
    expect(mockGet).toHaveBeenCalled();
  });

  it('checkQuota returns allowed=false when at limit', async () => {
    mockGet.mockResolvedValue(10);

    const result = await checkQuota('user-kv');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('consumeQuota calls kv.incr and sets TTL on first use', async () => {
    mockIncr.mockResolvedValue(1);

    const result = await consumeQuota('user-kv');
    expect(result.used).toBe(1);
    expect(mockIncr).toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalled();
  });

  it('consumeQuota does not set TTL on subsequent uses', async () => {
    mockIncr.mockResolvedValue(5);

    await consumeQuota('user-kv');
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('treats null kv.get as 0 used', async () => {
    mockGet.mockResolvedValue(null);

    const result = await checkQuota('user-kv');
    expect(result.used).toBe(0);
    expect(result.remaining).toBe(10);
  });
});
