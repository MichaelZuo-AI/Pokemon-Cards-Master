/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: 'test-user-123', name: 'Test', email: 'test@example.com' },
  }),
}));

// Mock quota — route now uses consumeQuota atomically (no separate checkQuota)
jest.mock('@/lib/quota', () => ({
  consumeQuota: jest.fn().mockResolvedValue({
    allowed: true,
    used: 1,
    limit: 1000,
    remaining: 999,
  }),
}));

// Mock @google/genai
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          nameCn: '皮卡丘',
          nameEn: 'Pikachu',
          nameJp: 'ピカチュウ',
          introduction: '皮卡丘是最受欢迎的电属性宝可梦。',
          types: ['电'],
          hp: '60',
          stage: '基础',
          attacks: [],
          weakness: '地面',
          resistance: '',
          retreatCost: '1',
          rarity: '普通',
          setName: '基础系列',
          cardNumber: '025/102',
          flavorText: '',
          ttsSummary: '皮卡丘，电属性，60HP。',
        }),
      }),
    },
  })),
  createPartFromBase64: jest.fn().mockReturnValue({ inlineData: { data: 'mock', mimeType: 'image/jpeg' } }),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/recognize-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/recognize-card', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects unauthenticated requests', async () => {
    const { auth } = require('@/lib/auth');
    auth.mockResolvedValueOnce(null);

    const req = makeRequest({ image: 'abc' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('请先登录');
  });

  it('returns 429 when quota is exceeded', async () => {
    const { consumeQuota } = require('@/lib/quota');
    consumeQuota.mockResolvedValueOnce({
      allowed: false,
      used: 1001,
      limit: 1000,
      remaining: 0,
    });

    const req = makeRequest({ image: 'abc' });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('今日扫描次数已用完');
    expect(data.quota.remaining).toBe(0);
  });

  it('rejects requests without image', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('请提供卡牌图片');
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = makeRequest({ image: 'abc123' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('API密钥未配置');
  });

  it('returns card info and quota on success', async () => {
    const req = makeRequest({ image: 'base64data' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameCn).toBe('皮卡丘');
    expect(data.cardInfo.nameEn).toBe('Pikachu');
    expect(data.quota.remaining).toBe(999);
  });

  it('consumes quota atomically before Gemini call', async () => {
    const { consumeQuota } = require('@/lib/quota');

    const req = makeRequest({ image: 'base64data' });
    await POST(req);

    expect(consumeQuota).toHaveBeenCalledWith('test-user-123');
  });
});
