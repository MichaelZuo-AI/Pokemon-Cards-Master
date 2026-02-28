/**
 * @jest-environment node
 */

// extractJSON is not exported — we test its branches indirectly via POST
// by controlling what text the Gemini mock returns.
import { POST } from '../route';
import { NextRequest } from 'next/server';

const PIKACHU_JSON = JSON.stringify({
  nameCn: '皮卡丘',
  nameEn: 'Pikachu',
  nameJp: 'ピカチュウ',
  introduction: '简介',
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
  ttsSummary: '皮卡丘。',
});

// jest.mock is hoisted above imports, so we capture the mock function via
// the module-level object trick instead of a let binding.
const genaiMocks = {
  generateContent: jest.fn(),
};

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: genaiMocks.generateContent },
  })),
  createPartFromBase64: jest.fn().mockReturnValue({
    inlineData: { data: 'mock', mimeType: 'image/jpeg' },
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/recognize-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Source': 'pokemon-cards-master',
    },
    body: JSON.stringify(body),
  });
}

describe('extractJSON – markdown fence variants', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('extracts JSON from ```json ... ``` fences', async () => {
    genaiMocks.generateContent.mockResolvedValueOnce({
      text: '```json\n' + PIKACHU_JSON + '\n```',
    });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameCn).toBe('皮卡丘');
  });

  it('extracts JSON from ``` ... ``` fences without language tag', async () => {
    genaiMocks.generateContent.mockResolvedValueOnce({
      text: '```\n' + PIKACHU_JSON + '\n```',
    });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameEn).toBe('Pikachu');
  });

  it('extracts raw JSON object when surrounded by non-JSON prose', async () => {
    // Falls through fence regex → hits the raw object regex /\{[\s\S]*\}/
    genaiMocks.generateContent.mockResolvedValueOnce({
      text: 'Here is the result: ' + PIKACHU_JSON + ' done.',
    });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameCn).toBe('皮卡丘');
  });

  it('returns 500 when the model returns plain non-JSON text (no object literal)', async () => {
    // extractJSON returns the raw string; JSON.parse throws; handler catches → 500
    genaiMocks.generateContent.mockResolvedValueOnce({
      text: 'Sorry, I cannot identify this card.',
    });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('识别失败，请重试');
  });

  it('returns 500 when Gemini text is null (response.text ?? "")', async () => {
    // response.text is null → extractJSON('') → JSON.parse('') throws → 500
    genaiMocks.generateContent.mockResolvedValueOnce({ text: null });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(500);
  });

  it('returns 400 when request body is malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/recognize-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Source': 'pokemon-cards-master',
      },
      body: 'not-valid-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('请求格式错误');
  });

  it('extracts JSON from fences that omit the newline after the language tag', async () => {
    // ```json{...}``` — regex is /```(?:json)?\s*\n?([\s\S]*?)\n?```/ so \n? makes it optional
    genaiMocks.generateContent.mockResolvedValueOnce({
      text: '```json' + PIKACHU_JSON + '```',
    });

    const res = await POST(makeRequest({ image: 'base64' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cardInfo.nameCn).toBe('皮卡丘');
  });

  it('returns 401 when X-App-Source header has wrong value', async () => {
    const req = new NextRequest('http://localhost:3000/api/recognize-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Source': 'wrong-source',
      },
      body: JSON.stringify({ image: 'base64' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('未授权的请求');
  });
});
