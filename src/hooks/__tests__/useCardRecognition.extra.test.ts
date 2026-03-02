import { renderHook, act } from '@testing-library/react';
import { useCardRecognition } from '../useCardRecognition';

const mockResizeImage = jest.fn().mockResolvedValue('data:image/jpeg;base64,resized');
const mockCreateThumbnail = jest.fn().mockResolvedValue('data:image/jpeg;base64,thumb');
const mockStripDataURIPrefix = jest.fn().mockReturnValue('resized-base64');
const mockAddScan = jest.fn().mockReturnValue({ id: 'mock-id' });

jest.mock('@/lib/imageResize', () => ({
  resizeImage: (...args: unknown[]) => mockResizeImage(...args),
  createThumbnail: (...args: unknown[]) => mockCreateThumbnail(...args),
  stripDataURIPrefix: (...args: unknown[]) => mockStripDataURIPrefix(...args),
}));

jest.mock('@/lib/storage', () => ({
  addScan: (...args: unknown[]) => mockAddScan(...args),
}));

const mockCardInfo = {
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
};

const makeFile = () => new File(['test'], 'card.jpg', { type: 'image/jpeg' });

describe('useCardRecognition – additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResizeImage.mockResolvedValue('data:image/jpeg;base64,resized');
    mockCreateThumbnail.mockResolvedValue('data:image/jpeg;base64,thumb');
    mockStripDataURIPrefix.mockReturnValue('resized-base64');
  });

  it('sets preview to the resized image data URL after recognition', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.preview).toBe('data:image/jpeg;base64,resized');
  });

  it('saves scan to history (addScan) after successful recognition', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(mockAddScan).toHaveBeenCalledTimes(1);
    expect(mockAddScan).toHaveBeenCalledWith(mockCardInfo, 'data:image/jpeg;base64,thumb');
  });

  it('strips the data URI prefix before sending to API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(mockStripDataURIPrefix).toHaveBeenCalledWith('data:image/jpeg;base64,resized');

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.image).toBe('resized-base64');
  });

  it('sends correct headers to the API (no X-App-Source)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/recognize-card');
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
    expect(fetchCall[1].headers['X-App-Source']).toBeUndefined();
  });

  it('uses generic fallback error message when fetch throws a non-Error object', async () => {
    global.fetch = jest.fn().mockRejectedValue('string-error');

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('识别失败，请重试');
  });

  it('uses error message from API response body when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: '服务器繁忙' }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('服务器繁忙');
  });

  it('uses fallback error text when non-ok response has no error field', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('识别失败');
  });

  it('uses fallback error text when non-ok response JSON parse fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('识别失败');
  });

  it('resets preview to null when reset() is called', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.cardInfo).toBeNull();
    expect(result.current.state).toBe('idle');
  });

  it('does not call addScan when recognition fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: '识别失败' }),
    });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    expect(mockAddScan).not.toHaveBeenCalled();
  });

  it('clears cardInfo and error at the start of a new recognition attempt', async () => {
    // First call: fails.
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: '第一次失败' }),
      })
      // Second call: succeeds.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ cardInfo: mockCardInfo }),
      });

    const { result } = renderHook(() => useCardRecognition());

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });
    expect(result.current.state).toBe('error');

    await act(async () => {
      await result.current.recognizeCard(makeFile());
    });

    // After second call succeeds, error should be cleared and state should be success.
    expect(result.current.state).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.cardInfo).toEqual(mockCardInfo);
  });
});
