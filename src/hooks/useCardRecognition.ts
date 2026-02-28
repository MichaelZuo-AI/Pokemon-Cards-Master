'use client';

import { useState, useCallback } from 'react';
import { CardInfo, RecognitionState } from '@/types/card';
import { resizeImage, createThumbnail, stripDataURIPrefix } from '@/lib/imageResize';
import { addScan } from '@/lib/storage';

interface UseCardRecognitionReturn {
  recognizeCard: (file: File) => Promise<void>;
  state: RecognitionState;
  cardInfo: CardInfo | null;
  error: string | null;
  preview: string | null;
  reset: () => void;
}

export function useCardRecognition(): UseCardRecognitionReturn {
  const [state, setState] = useState<RecognitionState>('idle');
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setCardInfo(null);
    setError(null);
    setPreview(null);
  }, []);

  const recognizeCard = useCallback(async (file: File) => {
    try {
      setState('loading');
      setError(null);
      setCardInfo(null);

      // Resize image and create preview
      const [resized, thumbnail] = await Promise.all([
        resizeImage(file),
        createThumbnail(file),
      ]);

      setPreview(resized);

      // Strip data URI prefix for API
      const base64 = stripDataURIPrefix(resized);

      const response = await fetch('/api/recognize-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Source': 'pokemon-cards-master',
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '识别失败');
      }

      const data = await response.json();
      const info = data.cardInfo as CardInfo;

      setCardInfo(info);
      setState('success');

      // Save to history
      addScan(info, thumbnail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败，请重试');
      setState('error');
    }
  }, []);

  return { recognizeCard, state, cardInfo, error, preview, reset };
}
