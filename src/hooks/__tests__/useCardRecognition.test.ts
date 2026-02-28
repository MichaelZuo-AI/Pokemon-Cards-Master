import { renderHook, act } from '@testing-library/react';
import { useCardRecognition } from '../useCardRecognition';

// Mock imageResize
jest.mock('@/lib/imageResize', () => ({
  resizeImage: jest.fn().mockResolvedValue('data:image/jpeg;base64,resized'),
  createThumbnail: jest.fn().mockResolvedValue('data:image/jpeg;base64,thumb'),
  stripDataURIPrefix: jest.fn().mockReturnValue('resized'),
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  addScan: jest.fn().mockReturnValue({ id: 'test-id' }),
}));

const mockCardInfo = {
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
  ttsSummary: '皮卡丘，电属性。',
};

describe('useCardRecognition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useCardRecognition());
    expect(result.current.state).toBe('idle');
    expect(result.current.cardInfo).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('recognizes card successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());
    const file = new File(['test'], 'card.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.recognizeCard(file);
    });

    expect(result.current.state).toBe('success');
    expect(result.current.cardInfo).toEqual(mockCardInfo);
    expect(result.current.error).toBeNull();
  });

  it('handles API error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: '识别失败' }),
    });

    const { result } = renderHook(() => useCardRecognition());
    const file = new File(['test'], 'card.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.recognizeCard(file);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('识别失败');
  });

  it('resets state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cardInfo: mockCardInfo }),
    });

    const { result } = renderHook(() => useCardRecognition());
    const file = new File(['test'], 'card.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await result.current.recognizeCard(file);
    });
    expect(result.current.state).toBe('success');

    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.cardInfo).toBeNull();
  });
});
