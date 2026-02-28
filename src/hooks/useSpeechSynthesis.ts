'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setIsSupported(true);
  }, []);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const speakWithEdgeTTS = useCallback(async (text: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'pokemon-cards-master',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) return false;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        cleanup();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        cleanup();
      };

      await audio.play();
      return true;
    } catch {
      return false;
    }
  }, [cleanup]);

  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.pitch = 1.15;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice =
      voices.find((v) => v.lang === 'zh-CN' && !v.localService) ||
      voices.find((v) => v.lang === 'zh-CN') ||
      voices.find((v) => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!isSupported) return;

    cleanup();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(true);

    // Try Edge TTS first, fall back to browser
    const success = await speakWithEdgeTTS(text);
    if (!success) {
      speakWithBrowser(text);
    }
  }, [isSupported, speakWithEdgeTTS, speakWithBrowser, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanup]);

  return { speak, stop, isSpeaking, isSupported };
}
