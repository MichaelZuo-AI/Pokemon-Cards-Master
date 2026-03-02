'use client';

import { useState, useCallback, useEffect } from 'react';

interface QuotaState {
  remaining: number;
  limit: number;
  used: number;
  loading: boolean;
}

export function useQuota() {
  const [quota, setQuota] = useState<QuotaState>({
    remaining: 10,
    limit: 10,
    used: 0,
    loading: true,
  });

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/quota');
      if (res.ok) {
        const data = await res.json();
        setQuota({
          remaining: data.quota.remaining,
          limit: data.quota.limit,
          used: data.quota.used,
          loading: false,
        });
      }
    } catch {
      // Silently fail — keep previous state
    }
  }, []);

  const updateFromResponse = useCallback((quotaData: { remaining: number; limit: number; used: number }) => {
    setQuota({
      remaining: quotaData.remaining,
      limit: quotaData.limit,
      used: quotaData.used,
      loading: false,
    });
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return {
    ...quota,
    isExhausted: quota.remaining === 0,
    refresh: fetchQuota,
    updateFromResponse,
  };
}
