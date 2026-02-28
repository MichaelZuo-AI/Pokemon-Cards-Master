import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects SpeechSynthesis support', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts not speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
  });

  it('calls speechSynthesis.speak with Chinese config', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('测试文本');
    });

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
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
