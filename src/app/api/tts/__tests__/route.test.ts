/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock msedge-tts
const mockOn = jest.fn();
const mockToStream = jest.fn();
const mockSetMetadata = jest.fn();

jest.mock('msedge-tts', () => ({
  MsEdgeTTS: jest.fn().mockImplementation(() => ({
    setMetadata: mockSetMetadata,
    toStream: mockToStream,
  })),
  OUTPUT_FORMAT: {
    AUDIO_24KHZ_96KBITRATE_MONO_MP3: 'audio-24khz-96kbitrate-mono-mp3',
  },
}));

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

// Helper to create a mock readable stream
function createMockAudioStream(data: Buffer) {
  const handlers: Record<string, Function> = {};
  const stream = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handler;
      // Auto-emit data then end on next tick
      if (event === 'error') {
        Promise.resolve().then(() => {
          handlers['data']?.(data);
          handlers['end']?.();
        });
      }
      return stream;
    }),
  };
  return stream;
}

describe('POST /api/tts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetMetadata.mockResolvedValue(undefined);
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

  it('returns MP3 audio on success', async () => {
    const fakeAudio = Buffer.from([0xff, 0xf3, 0xa4, 0xc4, 0x00]);
    const mockStream = createMockAudioStream(fakeAudio);
    mockToStream.mockReturnValue({ audioStream: mockStream });

    const req = makeRequest({ text: '你好世界' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');

    const arrayBuf = await res.arrayBuffer();
    expect(arrayBuf.byteLength).toBe(fakeAudio.length);
  });

  it('sets correct voice metadata', async () => {
    const fakeAudio = Buffer.from([0xff, 0xf3]);
    const mockStream = createMockAudioStream(fakeAudio);
    mockToStream.mockReturnValue({ audioStream: mockStream });

    const req = makeRequest({ text: '测试' });
    await POST(req);

    expect(mockSetMetadata).toHaveBeenCalledWith(
      'zh-CN-XiaoxiaoNeural',
      'audio-24khz-96kbitrate-mono-mp3',
    );
    expect(mockToStream).toHaveBeenCalledWith('测试');
  });

  it('returns 500 when TTS engine fails', async () => {
    mockSetMetadata.mockRejectedValue(new Error('connection failed'));

    const req = makeRequest({ text: '你好' });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('TTS生成失败');
  });

  it('returns 500 when audio stream errors', async () => {
    const handlers: Record<string, Function> = {};
    const errorStream = {
      on: jest.fn((event: string, handler: Function) => {
        handlers[event] = handler;
        if (event === 'error') {
          Promise.resolve().then(() => {
            handlers['error']?.(new Error('stream broken'));
          });
        }
        return errorStream;
      }),
    };
    mockToStream.mockReturnValue({ audioStream: errorStream });

    const req = makeRequest({ text: '你好' });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('sets cache control header for caching', async () => {
    const fakeAudio = Buffer.from([0xff, 0xf3]);
    const mockStream = createMockAudioStream(fakeAudio);
    mockToStream.mockReturnValue({ audioStream: mockStream });

    const req = makeRequest({ text: '缓存测试' });
    const res = await POST(req);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});
