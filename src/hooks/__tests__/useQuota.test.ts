import { renderHook, act, waitFor } from '@testing-library/react';
import { useQuota } from '../useQuota';

// The jest.setup.js sets NEXT_PUBLIC_BASE_PATH='' and mocks global.fetch, so
// apiPath('/api/quota') resolves to '/api/quota' throughout this file.

describe('useQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with loading=true', () => {
      // Stall the fetch so we can observe the initial state before it settles
      (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => useQuota());
      expect(result.current.loading).toBe(true);
    });

    it('starts with optimistic default values (remaining=1000, limit=1000, used=0)', () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => useQuota());
      expect(result.current.remaining).toBe(1000);
      expect(result.current.limit).toBe(1000);
      expect(result.current.used).toBe(0);
    });

    it('isExhausted is false on initial render (remaining=1000)', () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => useQuota());
      expect(result.current.isExhausted).toBe(false);
    });
  });

  // ── Successful fetch ───────────────────────────────────────────────────────

  describe('successful quota fetch', () => {
    it('calls GET /api/quota on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 7, limit: 10, used: 3 } }),
      });

      renderHook(() => useQuota());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/quota');
      });
    });

    it('updates state from the API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 6, limit: 10, used: 4 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.remaining).toBe(6);
      expect(result.current.limit).toBe(10);
      expect(result.current.used).toBe(4);
    });

    it('sets loading=false after a successful fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 10, limit: 10, used: 0 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('isExhausted is true when remaining is 0', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 0, limit: 10, used: 10 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.remaining).toBe(0);
      });

      expect(result.current.isExhausted).toBe(true);
    });

    it('isExhausted is false when remaining > 0', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 1, limit: 10, used: 9 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.remaining).toBe(1);
      });

      expect(result.current.isExhausted).toBe(false);
    });
  });

  // ── Non-ok response ────────────────────────────────────────────────────────

  describe('non-ok API response', () => {
    it('keeps previous state when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useQuota());

      // Wait for the fetch to settle — loading stays true because we never
      // got a successful response; remaining stays at the default 10.
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // State should remain at the initial defaults (non-ok path skips setQuota)
      expect(result.current.remaining).toBe(1000);
      expect(result.current.limit).toBe(1000);
      expect(result.current.used).toBe(0);
      // loading was never set to false, so it stays true
      expect(result.current.loading).toBe(true);
    });
  });

  // ── Network error ──────────────────────────────────────────────────────────

  describe('network error handling', () => {
    it('silently swallows network errors and keeps previous state', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // State stays at initial defaults — no throw, no crash
      expect(result.current.remaining).toBe(1000);
      expect(result.current.loading).toBe(true);
    });

    it('does not throw when fetch rejects', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Timeout'));

      expect(() => {
        renderHook(() => useQuota());
      }).not.toThrow();

      // Wait for the promise chain to settle without errors
      await act(async () => {
        await Promise.resolve();
      });
    });
  });

  // ── refresh() ─────────────────────────────────────────────────────────────

  describe('refresh()', () => {
    it('triggers a new GET /api/quota fetch', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ quota: { remaining: 8, limit: 10, used: 2 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ quota: { remaining: 5, limit: 10, used: 5 } }),
        });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.remaining).toBe(8);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.remaining).toBe(5);
      expect(result.current.used).toBe(5);
    });

    it('updates state when refresh() resolves with new data', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ quota: { remaining: 10, limit: 10, used: 0 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ quota: { remaining: 3, limit: 10, used: 7 } }),
        });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.remaining).toBe(10);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.remaining).toBe(3);
      expect(result.current.used).toBe(7);
      expect(result.current.loading).toBe(false);
    });
  });

  // ── updateFromResponse() ───────────────────────────────────────────────────

  describe('updateFromResponse()', () => {
    it('synchronously updates quota state from provided data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 10, limit: 10, used: 0 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateFromResponse({ remaining: 4, limit: 10, used: 6 });
      });

      expect(result.current.remaining).toBe(4);
      expect(result.current.limit).toBe(10);
      expect(result.current.used).toBe(6);
      expect(result.current.loading).toBe(false);
    });

    it('sets isExhausted=true when updateFromResponse sets remaining to 0', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 5, limit: 10, used: 5 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.remaining).toBe(5);
      });

      act(() => {
        result.current.updateFromResponse({ remaining: 0, limit: 10, used: 10 });
      });

      expect(result.current.isExhausted).toBe(true);
    });

    it('can be called without awaiting a mount fetch first', () => {
      // Stall the fetch so loading stays true
      (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

      const { result } = renderHook(() => useQuota());

      act(() => {
        result.current.updateFromResponse({ remaining: 9, limit: 10, used: 1 });
      });

      expect(result.current.remaining).toBe(9);
      expect(result.current.loading).toBe(false);
    });

    it('does not trigger another network request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ quota: { remaining: 10, limit: 10, used: 0 } }),
      });

      const { result } = renderHook(() => useQuota());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const callCountBefore = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        result.current.updateFromResponse({ remaining: 7, limit: 10, used: 3 });
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCountBefore);
    });
  });

});
