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
});
