import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from '../useSpeechSynthesis';

// Track Audio instances created
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn();
let lastAudioInstance: any = null;

global.Audio = jest.fn().mockImplementation(() => {
  lastAudioInstance = {
    play: mockPlay,
    pause: mockPause,
    src: '',
    onended: null,
    onerror: null,
    removeAttribute: jest.fn(),
  };
  return lastAudioInstance;
}) as any;

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastAudioInstance = null;
    (global.fetch as any) = jest.fn();
  });

  it('detects support', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts not speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSpeaking).toBe(false);
  });

  describe('Edge TTS (primary)', () => {
    it('fetches audio from /api/tts and plays it', async () => {
      const fakeBlob = new Blob(['audio'], { type: 'audio/mpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(fakeBlob),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('你好');
      });

      // Verify fetch was called with correct params
      expect(global.fetch).toHaveBeenCalledWith('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'pokemon-cards-master',
        },
        body: JSON.stringify({ text: '你好' }),
      });

      // Verify Audio was created and played
      expect(global.Audio).toHaveBeenCalled();
      expect(lastAudioInstance.src).toBeTruthy();
      expect(mockPlay).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(true);
    });

    it('pre-creates Audio element before fetch for mobile gesture unlock', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'])),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      let audioCreatedBeforeFetch = false;
      (global.Audio as jest.Mock).mockImplementation(() => {
        // Audio should be created before fetch resolves
        audioCreatedBeforeFetch = true;
        lastAudioInstance = {
          play: mockPlay, pause: mockPause, src: '',
          onended: null, onerror: null, removeAttribute: jest.fn(),
        };
        return lastAudioInstance;
      });

      await act(async () => {
        await result.current.speak('测试');
      });

      expect(audioCreatedBeforeFetch).toBe(true);
    });

    it('sets isSpeaking to false when audio ends', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'])),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('测试');
      });

      expect(result.current.isSpeaking).toBe(true);

      // Simulate audio ended
      act(() => {
        lastAudioInstance?.onended?.();
      });

      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('browser fallback', () => {
    it('falls back to browser TTS when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('测试文本');
      });

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('测试文本');
    });

    it('falls back to browser TTS when API returns error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('失败测试');
      });

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('失败测试');
    });

    it('falls back to browser TTS when audio.play() rejects', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'])),
      });
      mockPlay.mockRejectedValueOnce(new Error('NotAllowedError'));

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('播放失败');
      });

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('播放失败');
    });

    it('configures utterance with zh-CN and natural params', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('语音设置');
      });

      const utteranceInstance = (SpeechSynthesisUtterance as jest.Mock).mock.results[0].value;
      expect(utteranceInstance.lang).toBe('zh-CN');
      expect(utteranceInstance.rate).toBe(0.85);
      expect(utteranceInstance.pitch).toBe(1.15);
    });
  });

  describe('stop and cleanup', () => {
    it('stops audio playback on stop()', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['audio'])),
      });

      const { result } = renderHook(() => useSpeechSynthesis());

      await act(async () => {
        await result.current.speak('停止测试');
      });

      act(() => {
        result.current.stop();
      });

      expect(mockPause).toHaveBeenCalled();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
    });

    it('cleans up on unmount', () => {
      const { unmount } = renderHook(() => useSpeechSynthesis());
      unmount();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });
});
