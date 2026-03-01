'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

function speakWithBrowserTTS(text: string, onEnd: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd();
    return;
  }

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

  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();

  window.speechSynthesis.speak(utterance);
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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

  const speak = useCallback((text: string) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);

    // Pre-create Audio synchronously in click context (mobile gesture unlock)
    const audio = new Audio();
    audioRef.current = audio;

    // Fire async chain
    (async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Source': 'pokemon-cards-master',
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error(`TTS API error: ${res.status}`);

        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty audio response');

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audio.src = url;

        audio.onended = () => {
          setIsSpeaking(false);
          cleanup();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          cleanup();
        };

        await audio.play();
      } catch {
        // Fallback to browser SpeechSynthesis
        cleanup();
        speakWithBrowserTTS(text, () => setIsSpeaking(false));
      }
    })();
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [cleanup]);

  const isSupported = true;

  return { speak, stop, isSpeaking, isSupported };
}
