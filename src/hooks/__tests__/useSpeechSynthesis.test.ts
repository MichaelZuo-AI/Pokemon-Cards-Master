import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects support', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts not speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
  });

  describe('speak', () => {
    it('calls speechSynthesis.speak with correct utterance', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('你好');
      });

      expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('你好');
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(true);
    });

    it('configures utterance with zh-CN and natural params', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('语音设置');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.lang).toBe('zh-CN');
      expect(utterance.rate).toBe(0.85);
      expect(utterance.pitch).toBe(1.15);
    });

    it('cancels previous speech before speaking', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('第一句');
      });
      act(() => {
        result.current.speak('第二句');
      });

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('sets isSpeaking to false when utterance ends', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      expect(result.current.isSpeaking).toBe(true);

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      act(() => {
        utterance.onend();
      });

      expect(result.current.isSpeaking).toBe(false);
    });

    it('sets isSpeaking to false on utterance error', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      act(() => {
        utterance.onerror();
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('voice selection', () => {
    it('selects zh-CN remote voice if available', () => {
      const remoteZh = { lang: 'zh-CN', name: 'Remote', localService: false };
      const localZh = { lang: 'zh-CN', name: 'Local', localService: true };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([localZh, remoteZh]);

      const { result } = renderHook(() => useSpeechSynthesis());
      act(() => { result.current.speak('测试'); });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(remoteZh);
    });

    it('falls back to local zh-CN voice', () => {
      const localZh = { lang: 'zh-CN', name: 'Local', localService: true };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([localZh]);

      const { result } = renderHook(() => useSpeechSynthesis());
      act(() => { result.current.speak('测试'); });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(localZh);
    });

    it('falls back to any zh* voice', () => {
      const zhTw = { lang: 'zh-TW', name: 'Taiwan', localService: false };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([zhTw]);

      const { result } = renderHook(() => useSpeechSynthesis());
      act(() => { result.current.speak('测试'); });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(zhTw);
    });
  });

  describe('stop', () => {
    it('calls speechSynthesis.cancel and sets isSpeaking false', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => { result.current.speak('测试'); });
      act(() => { result.current.stop(); });

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
    });

    it('does not throw when called before speak', () => {
      const { result } = renderHook(() => useSpeechSynthesis());
      expect(() => {
        act(() => { result.current.stop(); });
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('cancels speech on unmount', () => {
      const { unmount } = renderHook(() => useSpeechSynthesis());
      unmount();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});
