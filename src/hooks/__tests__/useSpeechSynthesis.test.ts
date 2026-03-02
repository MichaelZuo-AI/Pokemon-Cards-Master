import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  let mockAudioInstance: {
    play: jest.Mock;
    pause: jest.Mock;
    removeAttribute: jest.Mock;
    src: string;
    onended: (() => void) | null;
    onerror: (() => void) | null;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAudioInstance = {
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      removeAttribute: jest.fn(),
      src: '',
      onended: null,
      onerror: null,
    };
    (global.Audio as jest.Mock).mockImplementation(() => mockAudioInstance);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    });
  });

  it('isSupported is always true', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts not speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
  });

  describe('speak — Cloud TTS path', () => {
    it('fetches /api/tts and plays audio', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('你好');
      });

      expect(result.current.isSpeaking).toBe(true);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tts', expect.objectContaining({
          method: 'POST',
        }));
      });

      await waitFor(() => {
        expect(mockAudioInstance.play).toHaveBeenCalled();
      });
    });

    it('sends correct headers and body to /api/tts', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试文本');
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tts', expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '测试文本' }),
        }));
      });
    });

    it('creates objectURL from blob and sets as audio src', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('你好');
      });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(mockAudioInstance.src).toBe('blob:mock-url');
      });
    });

    it('sets isSpeaking to false when audio ends', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      await waitFor(() => {
        expect(mockAudioInstance.onended).toBeTruthy();
      });

      act(() => {
        mockAudioInstance.onended!();
      });

      expect(result.current.isSpeaking).toBe(false);
    });

    it('sets isSpeaking to false on audio error', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      await waitFor(() => {
        expect(mockAudioInstance.onerror).toBeTruthy();
      });

      act(() => {
        mockAudioInstance.onerror!();
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('speak — browser TTS fallback', () => {
    it('falls back to browser SpeechSynthesis when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('回退测试');
      });

      await waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('回退测试');
      });
    });

    it('falls back when API returns non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('错误回退');
      });

      await waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
      });
    });

    it('falls back when blob is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob([], { type: 'audio/mpeg' })),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('空音频');
      });

      await waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
      });
    });

    it('falls back when audio.play() rejects', async () => {
      mockAudioInstance.play.mockRejectedValue(new Error('NotAllowedError'));

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('播放失败');
      });

      await waitFor(() => {
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
      });
    });
  });

  describe('stop', () => {
    it('pauses audio and cancels speechSynthesis', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      act(() => {
        result.current.stop();
      });

      expect(mockAudioInstance.pause).toHaveBeenCalled();
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
    it('cleans up on unmount', () => {
      const { result, unmount } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('测试');
      });

      unmount();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});
