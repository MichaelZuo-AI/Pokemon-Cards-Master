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
});
