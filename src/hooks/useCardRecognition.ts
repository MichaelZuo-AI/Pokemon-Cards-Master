'use client';

import { useState, useCallback } from 'react';
import { CardInfo, RecognitionState } from '@/types/card';
import { resizeImage, createThumbnail, stripDataURIPrefix } from '@/lib/imageResize';
import { addScan } from '@/lib/storage';

interface QuotaData {
  remaining: number;
  limit: number;
  used: number;
}

interface UseCardRecognitionOptions {
  onQuotaUpdate?: (quota: QuotaData) => void;
}

interface UseCardRecognitionReturn {
  recognizeCard: (file: File) => Promise<void>;
  state: RecognitionState;
  cardInfo: CardInfo | null;
  error: string | null;
  preview: string | null;
  reset: () => void;
}

export function useCardRecognition(options?: UseCardRecognitionOptions): UseCardRecognitionReturn {
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/recognize-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        if (data.quota) {
          options?.onQuotaUpdate?.(data.quota);
        }
        throw new Error(data.error || '今日扫描次数已用完');
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '识别失败');
      }

      const data = await response.json();
      const info = data.cardInfo as CardInfo;

      if (data.quota) {
        options?.onQuotaUpdate?.(data.quota);
      }

      setCardInfo(info);
      setState('success');

      // Save to history
      addScan(info, thumbnail);
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败，请重试');
      setState('error');
    }
  }, [options]);

  return { recognizeCard, state, cardInfo, error, preview, reset };
}
