/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock @google/genai
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({
        text: JSON.stringify({
          nameCn: '皮卡丘',
          nameEn: 'Pikachu',
          nameJp: 'ピカチュウ',
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

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Source': 'pokemon-cards-master',
    ...headers,
  };

  return new NextRequest('http://localhost:3000/api/recognize-card', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(body),
  });
}

describe('POST /api/recognize-card', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects requests without X-App-Source header', async () => {
    const req = new NextRequest('http://localhost:3000/api/recognize-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'abc' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
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

  it('returns card info on success', async () => {
    const req = makeRequest({ image: 'base64data' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameCn).toBe('皮卡丘');
    expect(data.cardInfo.nameEn).toBe('Pikachu');
  });
});
