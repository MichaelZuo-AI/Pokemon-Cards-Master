import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

describe('useSpeechSynthesis – additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('voice selection in browser TTS', () => {
    it('selects zh-CN remote voice (non-localService) if available', () => {
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

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(remoteZhVoice);
    });

    it('falls back to local zh-CN voice when no remote zh-CN voice is available', () => {
      const localZhVoice = { lang: 'zh-CN', name: 'Local Chinese', localService: true };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([localZhVoice]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('本地语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(localZhVoice);
    });

    it('falls back to any zh* voice when no zh-CN voice is available', () => {
      const zhTwVoice = { lang: 'zh-TW', name: 'Taiwan Chinese', localService: false };
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([zhTwVoice]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('台湾语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBe(zhTwVoice);
    });

    it('does not set voice when no Chinese voices are available', () => {
      (window.speechSynthesis.getVoices as jest.Mock).mockReturnValue([
        { lang: 'en-US', name: 'English', localService: false },
      ]);

      const { result } = renderHook(() => useSpeechSynthesis());

      act(() => {
        result.current.speak('无中文语音');
      });

      const utterance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utterance.voice).toBeNull();
    });
  });
});
