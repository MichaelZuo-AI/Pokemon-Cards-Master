import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

// Mock fetch to simulate Edge TTS failure (triggers browser fallback)
global.fetch = jest.fn().mockRejectedValue(new Error('network'));

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
  });

  it('detects support', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts not speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('falls back to browser speechSynthesis when Edge TTS fails', async () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    await act(async () => {
      await result.current.speak('测试文本');
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('测试文本');
  });

  it('calls cancel on stop', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.stop();
    });

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('cancels speech on unmount', () => {
    const { unmount } = renderHook(() => useSpeechSynthesis());
    unmount();
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });
});
