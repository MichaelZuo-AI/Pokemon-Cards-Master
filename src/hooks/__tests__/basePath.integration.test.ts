/**
 * basePath integration tests
 *
 * Verifies that the three hooks that call fetch() — useCardRecognition,
 * useSpeechSynthesis, and useQuota — all route their fetch calls through
 * @/lib/paths#apiPath, so that a non-empty BASE_PATH is automatically
 * prepended to every API URL.
 *
 * Strategy: mock @/lib/paths to return a spy apiPath function, then assert:
 *   1. apiPath() was called with the expected raw route, and
 *   2. fetch() was called with the URL that apiPath returned.
 *
 * Note: jest.mock() factories are hoisted before any variable declarations,
 * so we cannot reference `const` variables inside them.  We store the mock
 * function on a module-scope `let` that is assigned before the first test runs
 * via beforeAll, and the factory reads it lazily through a wrapper closure.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Must use `var` (or be assigned in beforeAll) because jest.mock is hoisted.
// We use a stable wrapper so the factory reference is always valid.
const pathsMock = {
  apiPath: jest.fn((route: string) => `/Pokemon/cardsmaster${route}`),
  BASE_PATH: '/Pokemon/cardsmaster',
};

jest.mock('@/lib/paths', () => ({
  get BASE_PATH() { return pathsMock.BASE_PATH; },
  apiPath: (route: string) => pathsMock.apiPath(route),
}));

// ── Dependency mocks for useCardRecognition ────────────────────────────────

jest.mock('@/lib/imageResize', () => ({
  resizeImage: jest.fn().mockResolvedValue('data:image/jpeg;base64,x'),
  createThumbnail: jest.fn().mockResolvedValue('data:image/jpeg;base64,t'),
  stripDataURIPrefix: jest.fn().mockReturnValue('base64data'),
}));

jest.mock('@/lib/storage', () => ({
  addScan: jest.fn(),
}));

// Now import the hooks — they will use the mocked @/lib/paths.
import { useCardRecognition } from '../useCardRecognition';
import { useSpeechSynthesis } from '../useSpeechSynthesis';
import { useQuota } from '../useQuota';

const BASE = '/Pokemon/cardsmaster';

beforeEach(() => {
  jest.clearAllMocks();
  // Restore the default "prefixed" behaviour for each test.
  pathsMock.apiPath.mockImplementation((route: string) => `${BASE}${route}`);
  pathsMock.BASE_PATH = BASE;
});

// ── useCardRecognition ─────────────────────────────────────────────────────

describe('useCardRecognition — basePath propagation', () => {
  it('calls apiPath() for the recognize-card route and uses the returned URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          cardInfo: {
            nameCn: '皮卡丘', nameEn: 'Pikachu', nameJp: 'ピカチュウ',
            introduction: '', types: [], hp: '60', stage: '基础',
            attacks: [], weakness: '', resistance: '', retreatCost: '1',
            rarity: '普通', setName: '', cardNumber: '', flavorText: '', ttsSummary: '',
          },
        }),
    });

    const { result } = renderHook(() => useCardRecognition());
    const file = new File(['img'], 'card.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.recognizeCard(file);
    });

    // The hook must call apiPath with the raw route …
    expect(pathsMock.apiPath).toHaveBeenCalledWith('/api/recognize-card');

    // … and then use the URL that apiPath returned as the fetch target.
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/api/recognize-card`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('honours a custom prefix returned by apiPath', async () => {
    const customBase = '/my-custom-base';
    pathsMock.apiPath.mockImplementation((route: string) => `${customBase}${route}`);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: '失败' }),
    });

    const { result } = renderHook(() => useCardRecognition());
    const file = new File(['img'], 'card.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.recognizeCard(file);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${customBase}/api/recognize-card`,
      expect.anything(),
    );
  });
});

// ── useSpeechSynthesis ─────────────────────────────────────────────────────

describe('useSpeechSynthesis — basePath propagation', () => {
  it('calls apiPath() for the TTS route and uses the returned URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    });

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('你好');
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE}/api/tts`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(pathsMock.apiPath).toHaveBeenCalledWith('/api/tts');
  });

  it('honours a custom prefix returned by apiPath', async () => {
    const customBase = '/my-custom-base';
    pathsMock.apiPath.mockImplementation((route: string) => `${customBase}${route}`);

    // Cause the fetch to fail so the fallback path is taken — we only care
    // about the URL that was used for the first fetch attempt.
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'));

    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('测试');
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${customBase}/api/tts`,
        expect.anything(),
      );
    });
  });
});

// ── useQuota ───────────────────────────────────────────────────────────────

describe('useQuota — basePath propagation', () => {
  it('calls apiPath() for the quota route and uses the returned URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ quota: { remaining: 10, limit: 10, used: 0 } }),
    });

    renderHook(() => useQuota());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`${BASE}/api/quota`);
    });

    expect(pathsMock.apiPath).toHaveBeenCalledWith('/api/quota');
  });

  it('honours a custom prefix returned by apiPath', async () => {
    const customBase = '/another-base';
    pathsMock.apiPath.mockImplementation((route: string) => `${customBase}${route}`);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ quota: { remaining: 5, limit: 10, used: 5 } }),
    });

    renderHook(() => useQuota());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`${customBase}/api/quota`);
    });
  });
});
