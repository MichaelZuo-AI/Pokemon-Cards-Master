/**
 * @jest-environment node
 *
 * Gap coverage for POST /api/recognize-card — targeting untested branches:
 *   1. Image size limit → 413
 *   2. sanitizeCardInfo fallback values for every field (wrong types)
 *   3. attacks array: items with wrong-typed fields fall back to empty strings
 *   4. types array: non-string elements are filtered out
 *   5. Model name (gemini-2.5-pro) is passed to generateContent
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Module-level object trick to work around jest.mock hoisting + temporal dead zone
const genaiMocks = {
  generateContent: jest.fn(),
};

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: genaiMocks.generateContent },
  })),
  createPartFromBase64: jest
    .fn()
    .mockReturnValue({ inlineData: { data: 'mock', mimeType: 'image/jpeg' } }),
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

/** Returns a minimal valid card JSON string that can be embedded in a mock response. */
function validCardJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    nameCn: '皮卡丘',
    nameEn: 'Pikachu',
    nameJp: 'ピカチュウ',
    introduction: '活泼的电气宝可梦。',
    types: ['电'],
    hp: '60',
    stage: '基础',
    attacks: [
      {
        name: '雷击',
        damage: '30',
        energyCost: '电',
        description: '基础攻击。',
      },
    ],
    weakness: '地面×2',
    resistance: '无',
    retreatCost: '1个无色能量',
    rarity: '普通',
    setName: '基础系列',
    cardNumber: '025/102',
    flavorText: '它的颊囊蓄满了电。',
    ttsSummary: '皮卡丘登场！',
    ...overrides,
  });
}

describe('POST /api/recognize-card – gap coverage', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  // ── 1. Image size limit ───────────────────────────────────────────────────
  describe('image size validation', () => {
    it('returns 413 when image base64 string exceeds MAX_IMAGE_SIZE (5 MB)', async () => {
      // 5 MB of base64 chars = 5 * 1024 * 1024 + 1 characters
      const oversizedImage = 'A'.repeat(5 * 1024 * 1024 + 1);
      const req = makeRequest({ image: oversizedImage });
      const res = await POST(req);

      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error).toBe('图片太大，请压缩后重试');
    });

    it('accepts an image exactly at the size limit', async () => {
      const boundaryImage = 'A'.repeat(5 * 1024 * 1024);
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson(),
      });

      const req = makeRequest({ image: boundaryImage });
      const res = await POST(req);

      // Should not be rejected — exactly at the limit is allowed
      expect(res.status).toBe(200);
    });
  });

  // ── 2. sanitizeCardInfo fallbacks for wrong-typed fields ─────────────────
  describe('sanitizeCardInfo – fallback defaults for wrong-typed fields', () => {
    it('substitutes "未知" for nameCn when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ nameCn: 42 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.nameCn).toBe('未知');
    });

    it('substitutes "Unknown" for nameEn when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ nameEn: null }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.nameEn).toBe('Unknown');
    });

    it('substitutes "" for nameJp when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ nameJp: 123 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.nameJp).toBe('');
    });

    it('substitutes "" for introduction when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ introduction: true }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.introduction).toBe('');
    });

    it('substitutes "0" for hp when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ hp: 60 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.hp).toBe('0');
    });

    it('substitutes "" for stage when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ stage: [] }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.stage).toBe('');
    });

    it('substitutes "" for weakness when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ weakness: { type: '地面' } }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.weakness).toBe('');
    });

    it('substitutes "" for resistance when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ resistance: 0 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.resistance).toBe('');
    });

    it('substitutes "" for retreatCost when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ retreatCost: false }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.retreatCost).toBe('');
    });

    it('substitutes "" for rarity when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ rarity: null }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.rarity).toBe('');
    });

    it('substitutes "" for setName when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ setName: 99 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.setName).toBe('');
    });

    it('substitutes "" for cardNumber when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ cardNumber: undefined }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.cardNumber).toBe('');
    });

    it('substitutes "" for flavorText when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ flavorText: {} }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.flavorText).toBe('');
    });

    it('substitutes "" for ttsSummary when value is not a string', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ ttsSummary: 42 }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.ttsSummary).toBe('');
    });
  });

  // ── 3. types array: non-string items are filtered out ─────────────────────
  describe('sanitizeCardInfo – types array filtering', () => {
    it('filters out non-string elements from the types array', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ types: ['电', 42, null, '火', true] }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      // Only the actual strings survive
      expect(data.cardInfo.types).toEqual(['电', '火']);
    });

    it('returns an empty types array when types is not an array', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ types: '电' }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.types).toEqual([]);
    });

    it('returns an empty types array when types is null', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ types: null }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.types).toEqual([]);
    });
  });

  // ── 4. attacks array: fallbacks for wrong-typed attack fields ─────────────
  describe('sanitizeCardInfo – attacks array', () => {
    it('returns empty attacks array when attacks is not an array', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({ attacks: 'not-an-array' }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.attacks).toEqual([]);
    });

    it('falls back to empty strings for attack fields that are not strings', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({
          attacks: [
            {
              name: 99,           // not a string → ''
              damage: null,       // not a string → ''
              energyCost: true,   // not a string → ''
              description: [],    // not a string → ''
            },
          ],
        }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.attacks).toHaveLength(1);
      expect(data.cardInfo.attacks[0]).toEqual({
        name: '',
        damage: '',
        energyCost: '',
        description: '',
      });
    });

    it('preserves valid string attack fields while falling back invalid ones', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson({
          attacks: [
            {
              name: '雷击',
              damage: 42,       // not a string → ''
              energyCost: '电',
              description: null, // not a string → ''
            },
          ],
        }),
      });

      const res = await POST(makeRequest({ image: 'base64' }));
      const data = await res.json();
      expect(data.cardInfo.attacks[0]).toEqual({
        name: '雷击',
        damage: '',
        energyCost: '电',
        description: '',
      });
    });
  });

  // ── 5. Model name is passed correctly to generateContent ──────────────────
  describe('model configuration', () => {
    it('calls generateContent with model "gemini-2.5-pro"', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson(),
      });

      await POST(makeRequest({ image: 'base64' }));

      expect(genaiMocks.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.5-pro' }),
      );
    });

    it('calls generateContent with a user role content part', async () => {
      genaiMocks.generateContent.mockResolvedValueOnce({
        text: validCardJson(),
      });

      await POST(makeRequest({ image: 'base64' }));

      const callArg = genaiMocks.generateContent.mock.calls[0][0];
      expect(callArg.contents[0].role).toBe('user');
      // Two parts: the image and the system prompt text
      expect(callArg.contents[0].parts).toHaveLength(2);
    });
  });

  // ── 6. Gemini throws (network / quota error) → 500 ───────────────────────
  describe('Gemini API throws', () => {
    it('returns 500 with error message when generateContent throws', async () => {
      genaiMocks.generateContent.mockRejectedValueOnce(
        new Error('API quota exceeded'),
      );

      const res = await POST(makeRequest({ image: 'base64' }));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('识别失败，请重试');
    });
  });

  // ── 7. Empty image string → 400 ──────────────────────────────────────────
  describe('empty image field', () => {
    it('returns 400 when image is an empty string', async () => {
      const res = await POST(makeRequest({ image: '' }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('请提供卡牌图片');
    });
  });
});
