/**
 * @jest-environment node
 *
 * Tests for src/app/api/auth/[...nextauth]/route.ts
 *
 * The route contains two things:
 *   1. patchUrl() — re-adds the basePath to the request URL when Vercel strips it
 *   2. GET / POST handlers that forward to Auth.js after patching
 *
 * Strategy:
 *   - Mock @/lib/paths so tests can control BASE_PATH without env mutations.
 *   - Mock @/lib/auth so handlers.GET / handlers.POST are jest functions whose
 *     responses are inspectable.
 *   - Import the route after mocks are set up so module-level BASE_PATH is captured.
 *   - Test patchUrl behaviour indirectly by inspecting the URL received by the
 *     handlers mock.
 */

// ── Mocks (must be declared before imports) ─────────────────────────────────

const mockHandlerGet = jest.fn();
const mockHandlerPost = jest.fn();

// Mock Auth.js — the route uses `handlers.GET` and `handlers.POST`.
jest.mock('@/lib/auth', () => ({
  handlers: {
    GET: mockHandlerGet,
    POST: mockHandlerPost,
  },
}));

// Mock @/lib/paths — start with an empty base path; individual tests may
// change pathsMock.BASE_PATH and re-require the module to get a fresh copy.
const pathsMock = { BASE_PATH: '' };

jest.mock('@/lib/paths', () => ({
  get BASE_PATH() {
    return pathsMock.BASE_PATH;
  },
}));

import { NextRequest } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, method = 'GET'): NextRequest {
  return new NextRequest(url, { method });
}

/** Returns the URL string that the handler mock was called with. */
function capturedUrl(mock: jest.Mock): string {
  const req: NextRequest = mock.mock.calls[0][0];
  return req.url;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('auth route — patchUrl (no BASE_PATH)', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.clearAllMocks();
    // Re-require after env change so BASE_PATH constant is re-evaluated.
    jest.resetModules();
    // Re-apply mocks after resetModules so they stay active.
    jest.mock('@/lib/auth', () => ({
      handlers: { GET: mockHandlerGet, POST: mockHandlerPost },
    }));
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('passes the request unchanged when BASE_PATH is empty', async () => {
    const { GET } = require('../route');
    const originalUrl = 'https://example.com/api/auth/callback/google';
    const req = makeRequest(originalUrl);
    mockHandlerGet.mockResolvedValueOnce(new Response('ok'));

    await GET(req);

    expect(mockHandlerGet).toHaveBeenCalledTimes(1);
    expect(capturedUrl(mockHandlerGet)).toBe(originalUrl);
  });
});

describe('auth route — patchUrl (with BASE_PATH)', () => {
  const BASE = '/Pokemon/cardsmaster';

  beforeEach(() => {
    pathsMock.BASE_PATH = BASE;
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({
      handlers: { GET: mockHandlerGet, POST: mockHandlerPost },
    }));
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('prepends BASE_PATH when the URL pathname lacks it', async () => {
    const { GET } = require('../route');
    // Vercel strips the basePath — pathname arrives WITHOUT /Pokemon/cardsmaster
    const req = makeRequest('https://example.com/api/auth/callback/google');
    mockHandlerGet.mockResolvedValueOnce(new Response('ok'));

    await GET(req);

    expect(capturedUrl(mockHandlerGet)).toBe(
      'https://example.com/Pokemon/cardsmaster/api/auth/callback/google',
    );
  });

  it('does NOT double-prepend when pathname already starts with BASE_PATH', async () => {
    const { GET } = require('../route');
    // If the URL already has the basePath (non-Vercel env or proxied request)
    const url = `https://example.com${BASE}/api/auth/callback/google`;
    const req = makeRequest(url);
    mockHandlerGet.mockResolvedValueOnce(new Response('ok'));

    await GET(req);

    const called = capturedUrl(mockHandlerGet);
    // Should not be double-prefixed
    expect(called).toBe(url);
    expect(called).not.toContain(`${BASE}${BASE}`);
  });

  it('preserves query string when patching URL', async () => {
    const { GET } = require('../route');
    const req = makeRequest(
      'https://example.com/api/auth/callback/google?code=abc&state=xyz',
    );
    mockHandlerGet.mockResolvedValueOnce(new Response('ok'));

    await GET(req);

    const called = capturedUrl(mockHandlerGet);
    expect(called).toContain('?code=abc&state=xyz');
    expect(called).toContain(BASE);
  });

  it('passes the patched request to handlers.GET on GET requests', async () => {
    const { GET } = require('../route');
    const mockResponse = new Response('auth ok', { status: 200 });
    mockHandlerGet.mockResolvedValueOnce(mockResponse);

    const result = await GET(makeRequest('https://example.com/api/auth/session'));

    expect(mockHandlerGet).toHaveBeenCalledTimes(1);
    expect(mockHandlerPost).not.toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  it('passes the patched request to handlers.POST on POST requests', async () => {
    const { POST } = require('../route');
    const mockResponse = new Response('signed in', { status: 200 });
    mockHandlerPost.mockResolvedValueOnce(mockResponse);

    const result = await POST(
      new NextRequest('https://example.com/api/auth/signin/google', {
        method: 'POST',
        body: JSON.stringify({ csrfToken: 'tok' }),
      }),
    );

    expect(mockHandlerPost).toHaveBeenCalledTimes(1);
    expect(mockHandlerGet).not.toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  it('prepends BASE_PATH for POST requests too', async () => {
    const { POST } = require('../route');
    mockHandlerPost.mockResolvedValueOnce(new Response('ok'));

    await POST(
      new NextRequest('https://example.com/api/auth/signin/google', { method: 'POST' }),
    );

    expect(capturedUrl(mockHandlerPost)).toContain(BASE);
  });
});

describe('auth route — GET / POST return values', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({
      handlers: { GET: mockHandlerGet, POST: mockHandlerPost },
    }));
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('GET returns whatever handlers.GET returns', async () => {
    const { GET } = require('../route');
    const expected = new Response(JSON.stringify({ session: null }), { status: 200 });
    mockHandlerGet.mockResolvedValueOnce(expected);

    const result = await GET(makeRequest('https://example.com/api/auth/session'));
    expect(result).toBe(expected);
  });

  it('POST returns whatever handlers.POST returns', async () => {
    const { POST } = require('../route');
    const expected = new Response(null, { status: 302, headers: { Location: '/login' } });
    mockHandlerPost.mockResolvedValueOnce(expected);

    const result = await POST(
      new NextRequest('https://example.com/api/auth/signout', { method: 'POST' }),
    );
    expect(result).toBe(expected);
  });
});
