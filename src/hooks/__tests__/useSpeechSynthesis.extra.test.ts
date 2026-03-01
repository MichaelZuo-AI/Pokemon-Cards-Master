import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

describe('useSpeechSynthesis – additional coverage', () => {
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
  });

  describe('stop() when not currently speaking', () => {
    it('calls speechSynthesis.cancel() even when nothing is playing', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.stop();
      });

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
    });

    it('does not throw when stop() is called before any speak()', () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      expect(() => {
        act(() => {
          result.current.stop();
        });
      }).not.toThrow();
    });
  });

  describe('voice selection in browser TTS fallback', () => {
    beforeEach(() => {
      // Make fetch fail so we trigger the browser TTS fallback
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fail'));
    });

    it('selects zh-CN remote voice (non-localService) if available', async () => {
      const remoteZhVoice = { lang: 'zh-CN', name: 'Remote Chinese', localService: false };
      const localZhVoice = { lang: 'zh-CN', name: 'Local Chinese', localService: true };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([
        localZhVoice,
        remoteZhVoice,
      ]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('远程语音');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('远程语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(remoteZhVoice);
    });

    it('falls back to local zh-CN voice when no remote zh-CN voice is available', async () => {
      const localZhVoice = { lang: 'zh-CN', name: 'Local Chinese', localService: true };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([localZhVoice]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('本地语音');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('本地语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(localZhVoice);
    });

    it('falls back to any zh* voice when no zh-CN voice is available', async () => {
      const zhTwVoice = { lang: 'zh-TW', name: 'Taiwan Chinese', localService: false };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([zhTwVoice]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('台湾语音');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('台湾语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(zhTwVoice);
    });

    it('does not set voice when no Chinese voices are available', async () => {
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([
        { lang: 'en-US', name: 'English', localService: false },
      ]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('无中文语音');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('无中文语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBeNull();
    });
  });

  // ── AbortController / stop() abort behaviour ─────────────────────────────
  describe('AbortController abort behaviour', () => {
    it('stop() aborts the in-flight fetch before it resolves', async () => {
      // Hold the fetch promise hostage so we can stop() while it is in-flight
      let resolveFetch!: (value: unknown) => void;
      (global.fetch as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('中止测试');
      });

      // stop() should abort the controller
      act(() => {
        result.current.stop();
      });

      expect(result.current.isSpeaking).toBe(false);

      // Now let fetch resolve — the hook should ignore it because it was aborted
      act(() => {
        resolveFetch({ ok: true, blob: () => Promise.resolve(new Blob(['audio'])) });
      });

      // Audio.play should never have been called
      expect(mockAudioInstance.play).not.toHaveBeenCalled();
    });

    it('does not fall back to browser TTS when the abort is intentional (stop() called)', async () => {
      // Fetch rejects with an AbortError (simulating the controller.abort() path)
      let rejectFetch!: (err: Error) => void;
      (global.fetch as jest.Mock).mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectFetch = reject;
        }),
      );

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('不应回退');
      });

      // Abort first, then reject so the catch block sees a signal.aborted === true
      act(() => {
        result.current.stop();
      });

      // Make fetch throw after abort
      await act(async () => {
        const abortError = new DOMException('The user aborted a request.', 'AbortError');
        rejectFetch(abortError);
        // flush promises
        await Promise.resolve();
      });

      // Browser TTS should NOT have been called
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('second speak() pauses the old audio element', async () => {
      const firstAudio = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        removeAttribute: jest.fn(),
        src: '',
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      const secondAudio = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        removeAttribute: jest.fn(),
        src: '',
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      (global.Audio as jest.Mock)
        .mockImplementationOnce(() => firstAudio)
        .mockImplementationOnce(() => secondAudio);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
        });

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('第一次');
      });

      await waitFor(() => {
        expect(firstAudio.play).toHaveBeenCalledTimes(1);
      });

      // Second speak — should pause the first audio
      act(() => {
        result.current.speak('第二次');
      });

      expect(firstAudio.pause).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(true);
    });
  });

  // ── URL cleanup (revokeObjectURL) ─────────────────────────────────────────
  describe('objectURL cleanup', () => {
    it('revokes the objectURL when audio finishes playing', async () => {
      // Need a fresh audio mock that won't be nulled by cleanup
      const audio = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        removeAttribute: jest.fn(),
        src: '',
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      (global.Audio as jest.Mock).mockImplementationOnce(() => audio);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('清理测试');
      });

      await waitFor(() => {
        expect(audio.onended).toBeTruthy();
      });

      act(() => {
        audio.onended!();
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('revokes the objectURL when stop() is called after playback starts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('停止清理');
      });

      await waitFor(() => {
        expect(mockAudioInstance.play).toHaveBeenCalled();
      });

      act(() => {
        result.current.stop();
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('revokes the objectURL on unmount after playback starts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
      });

      const { result, unmount } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('卸载清理');
      });

      await waitFor(() => {
        expect(mockAudioInstance.play).toHaveBeenCalled();
      });

      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  // ── Browser TTS utterance callbacks set isSpeaking ────────────────────────
  describe('browser TTS fallback utterance callbacks', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    });

    it('sets isSpeaking to false when utterance onend fires', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('结束回调');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('结束回调');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      act(() => {
        utterance.onend();
      });

      expect(result.current.isSpeaking).toBe(false);
    });

    it('sets isSpeaking to false when utterance onerror fires', async () => {
      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('错误回调');
      });

      await waitFor(() => {
        expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('错误回调');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;

      act(() => {
        utterance.onerror();
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });
});
