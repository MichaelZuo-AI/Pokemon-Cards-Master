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
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    // Abort any in-flight fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
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
    // Stop any current playback + abort in-flight fetch
    cleanup();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);

    // Pre-create Audio synchronously in click context (mobile gesture unlock)
    const audio = new Audio();
    audioRef.current = audio;

    // Create abort controller for this request
    const controller = new AbortController();
    abortRef.current = controller;

    // Fire async chain
    (async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`TTS API error: ${res.status}`);

        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty audio response');

        // If aborted while waiting for blob, bail out
        if (controller.signal.aborted) return;

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
      } catch (err) {
        // Don't fallback if we intentionally aborted (user clicked stop)
        if (controller.signal.aborted) return;

        // Fallback to browser SpeechSynthesis
        console.warn('[TTS] Cloud TTS failed, falling back to browser:', err);
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
