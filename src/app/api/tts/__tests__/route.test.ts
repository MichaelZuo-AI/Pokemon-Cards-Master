/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

const originalFetch = global.fetch;

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Source': 'pokemon-cards-master',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/tts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLOUD_TTS_API_KEY = 'test-api-key';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('rejects requests without X-App-Source header', async () => {
    const req = new NextRequest('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong X-App-Source header', async () => {
    const req = makeRequest({ text: '你好' }, { 'X-App-Source': 'wrong-source' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests without text', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('请提供朗读文本');
  });

  it('rejects empty text', async () => {
    const req = makeRequest({ text: '' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Source': 'pokemon-cards-master',
      },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('请求格式错误');
  });

  it('rejects text exceeding MAX_TEXT_LENGTH', async () => {
    const req = makeRequest({ text: 'a'.repeat(2001) });
    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toBe('文本过长');
  });

  it('accepts text exactly at the limit', async () => {
    const fakeBase64 = Buffer.from([0xff]).toString('base64');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audioContent: fakeBase64 }),
    });

    const req = makeRequest({ text: 'a'.repeat(2000) });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.GOOGLE_CLOUD_TTS_API_KEY;
    const req = makeRequest({ text: '你好' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('TTS服务未配置');
  });

  it('returns MP3 audio on success', async () => {
    const fakeBase64 = Buffer.from([0xff, 0xf3, 0xa4, 0xc4, 0x00]).toString('base64');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audioContent: fakeBase64 }),
    });

    const req = makeRequest({ text: '你好世界' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');

    const arrayBuf = await res.arrayBuffer();
    expect(arrayBuf.byteLength).toBe(5);
  });

  it('sends correct request to Google Cloud TTS API', async () => {
    const fakeBase64 = Buffer.from([0xff]).toString('base64');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audioContent: fakeBase64 }),
    });

    const req = makeRequest({ text: '测试' });
    await POST(req);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=test-api-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml: '<speak>测试</speak>' },
          voice: { languageCode: 'cmn-CN', name: 'cmn-CN-Standard-A' },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }),
    );
  });

  it('returns 500 when Google API returns error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    const req = makeRequest({ text: '你好' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('TTS生成失败');
  });

  it('returns 500 when fetch throws (e.g. timeout)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('aborted'));

    const req = makeRequest({ text: '你好' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('TTS生成失败');
  });

  it('sets cache control header', async () => {
    const fakeBase64 = Buffer.from([0xff, 0xf3]).toString('base64');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audioContent: fakeBase64 }),
    });

    const req = makeRequest({ text: '缓存测试' });
    const res = await POST(req);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('sets Content-Length header correctly', async () => {
    const fakeAudio = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const fakeBase64 = fakeAudio.toString('base64');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ audioContent: fakeBase64 }),
    });

    const req = makeRequest({ text: '长度测试' });
    const res = await POST(req);
    expect(res.headers.get('Content-Length')).toBe('5');
  });

  // ── runtime export ────────────────────────────────────────────────────────
  describe('edge runtime declaration', () => {
    it('exports runtime as "edge"', async () => {
      // Dynamically import to read the module export value
      const routeModule = await import('../route');
      expect((routeModule as Record<string, unknown>).runtime).toBe('edge');
    });
  });

  // ── SSML sanitization ─────────────────────────────────────────────────────
  describe('SSML input sanitization', () => {
    async function captureSSML(text: string): Promise<string> {
      const fakeBase64 = Buffer.from([0xff]).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ audioContent: fakeBase64 }),
      });
      await POST(makeRequest({ text }));
      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      return callBody.input.ssml as string;
    }

    it('wraps plain text in <speak> tags', async () => {
      const ssml = await captureSSML('你好');
      expect(ssml).toBe('<speak>你好</speak>');
    });

    it('escapes & to &amp; inside SSML', async () => {
      const ssml = await captureSSML('攻&守');
      expect(ssml).toContain('攻&amp;守');
      expect(ssml).not.toContain('攻&守');
    });

    it('escapes < to &lt; inside SSML', async () => {
      const ssml = await captureSSML('a<b');
      expect(ssml).toContain('a&lt;b');
      expect(ssml).not.toContain('a<b');
    });

    it('escapes > to &gt; inside SSML', async () => {
      const ssml = await captureSSML('a>b');
      expect(ssml).toContain('a&gt;b');
      expect(ssml).not.toContain('a>b');
    });

    it('escapes all three special characters in the same text', async () => {
      const ssml = await captureSSML('a&b<c>d');
      expect(ssml).toBe('<speak>a&amp;b&lt;c&gt;d</speak>');
    });

    it('inserts a newline after Chinese comma 、', async () => {
      const ssml = await captureSSML('草、火');
      // 、 should be followed by \n before the SSML closing tag
      expect(ssml).toContain('、\n');
    });

    it('inserts a newline after Chinese enumeration comma ，', async () => {
      const ssml = await captureSSML('它聪明，勇敢');
      expect(ssml).toContain('，\n');
    });

    it('inserts newlines after every comma occurrence in long text', async () => {
      const ssml = await captureSSML('a，b，c');
      // Each ， should be followed by a newline
      const newlineCount = (ssml.match(/，\n/g) || []).length;
      expect(newlineCount).toBe(2);
    });

    it('does not alter text that has no special characters', async () => {
      const ssml = await captureSSML('皮卡丘');
      expect(ssml).toBe('<speak>皮卡丘</speak>');
    });
  });

  // ── atob / Uint8Array decoding ────────────────────────────────────────────
  describe('edge-runtime base64 decoding via atob', () => {
    it('decodes base64 and returns the correct byte values', async () => {
      // Encode three known bytes and verify they come back correctly
      const originalBytes = [0xde, 0xad, 0xbe];
      const fakeBase64 = Buffer.from(originalBytes).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ audioContent: fakeBase64 }),
      });

      const res = await POST(makeRequest({ text: '字节测试' }));
      expect(res.status).toBe(200);

      const arrayBuf = await res.arrayBuffer();
      const resultBytes = Array.from(new Uint8Array(arrayBuf));
      expect(resultBytes).toEqual(originalBytes);
    });

    it('returns a body whose byte count matches the decoded base64 length', async () => {
      // 10 bytes → base64 → decode → still 10 bytes
      const tenBytes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const fakeBase64 = Buffer.from(tenBytes).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ audioContent: fakeBase64 }),
      });

      const res = await POST(makeRequest({ text: '字节数测试' }));
      const arrayBuf = await res.arrayBuffer();
      expect(arrayBuf.byteLength).toBe(10);
    });
  });

  // ── AbortController / signal propagation ─────────────────────────────────
  describe('AbortController signal is passed to fetch', () => {
    it('includes a signal property in the fetch options', async () => {
      const fakeBase64 = Buffer.from([0xff]).toString('base64');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ audioContent: fakeBase64 }),
      });

      await POST(makeRequest({ text: '中止测试' }));

      const fetchOptions = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(fetchOptions).toHaveProperty('signal');
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
