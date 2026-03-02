/**
 * @jest-environment node
 *
 * Tests for src/middleware.ts
 *
 * The middleware:
 *   1. Wraps the route callback with Auth.js `auth()`.
 *   2. If `req.auth` is falsy → redirects to `${BASE_PATH}/login`.
 *   3. If `req.auth` is truthy → calls `NextResponse.next()`.
 *   4. Exports a `config` with a `matcher` array.
 *
 * Strategy:
 *   - Mock `@/lib/auth` so we can capture the callback passed to `auth()` and
 *     call it directly in tests.
 *   - Mock `@/lib/paths` to control BASE_PATH.
 *   - Mock `next/server` so we can inspect NextResponse calls.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

// Capture the middleware callback that the module passes to auth().
let capturedMiddlewareCallback: ((req: any) => any) | null = null;

const mockAuth = jest.fn((cb: (req: any) => any) => {
  capturedMiddlewareCallback = cb;
  // Return value simulates the wrapped middleware function (not used in unit tests)
  return cb;
});

jest.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

const pathsMock = { BASE_PATH: '' };
jest.mock('@/lib/paths', () => ({
  get BASE_PATH() { return pathsMock.BASE_PATH; },
}));

const mockRedirect = jest.fn();
const mockNext = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: mockRedirect,
    next: mockNext,
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(options: { auth?: object | null; origin?: string } = {}) {
  return {
    auth: options.auth ?? null,
    nextUrl: {
      origin: options.origin ?? 'https://example.com',
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('middleware — registration', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.clearAllMocks();
    jest.resetModules();
    // Re-apply mocks after resetModules
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));
    capturedMiddlewareCallback = null;
  });

  it('calls auth() exactly once with a callback when the module is loaded', () => {
    require('../../middleware');
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(capturedMiddlewareCallback).toBeInstanceOf(Function);
  });
});

describe('middleware — callback behaviour (no BASE_PATH)', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));
    capturedMiddlewareCallback = null;
    require('../../middleware');
  });

  it('redirects to /login when req.auth is null (unauthenticated)', () => {
    const fakeRedirectResponse = { type: 'redirect' };
    mockRedirect.mockReturnValueOnce(fakeRedirectResponse);

    const result = capturedMiddlewareCallback!(makeReq({ auth: null }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    // Redirect URL should be /login (no basePath prefix when BASE_PATH is empty)
    const redirectUrl: URL = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/login');
    expect(result).toBe(fakeRedirectResponse);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('redirects to /login when req.auth is undefined (unauthenticated)', () => {
    mockRedirect.mockReturnValueOnce({});
    capturedMiddlewareCallback!(makeReq({ auth: undefined as any }));

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls NextResponse.next() when req.auth is set (authenticated)', () => {
    const fakeNext = { type: 'next' };
    mockNext.mockReturnValueOnce(fakeNext);

    const result = capturedMiddlewareCallback!(makeReq({ auth: { user: { id: 'u1' } } }));

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(fakeNext);
  });

  it('uses the request origin when constructing the redirect URL', () => {
    mockRedirect.mockReturnValueOnce({});
    capturedMiddlewareCallback!(makeReq({ auth: null, origin: 'https://my-app.vercel.app' }));

    const redirectUrl: URL = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.origin).toBe('https://my-app.vercel.app');
  });
});

describe('middleware — callback behaviour (with BASE_PATH)', () => {
  const BASE = '/Pokemon/cardsmaster';

  beforeEach(() => {
    pathsMock.BASE_PATH = BASE;
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));
    capturedMiddlewareCallback = null;
    require('../../middleware');
  });

  it('redirects to BASE_PATH + /login when unauthenticated', () => {
    mockRedirect.mockReturnValueOnce({});
    capturedMiddlewareCallback!(makeReq({ auth: null }));

    const redirectUrl: URL = mockRedirect.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe(`${BASE}/login`);
  });

  it('still calls NextResponse.next() for authenticated requests (basePath present)', () => {
    mockNext.mockReturnValueOnce({});
    capturedMiddlewareCallback!(makeReq({ auth: { user: { id: 'u2' } } }));

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('middleware — config export', () => {
  it('exports a config object with a matcher array', () => {
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));

    const { config } = require('../../middleware');
    expect(config).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it('matcher includes the root path /', () => {
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));

    const { config } = require('../../middleware');
    expect(config.matcher).toContain('/');
  });

  it('matcher does not list /login (login page must not be gated)', () => {
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));

    const { config } = require('../../middleware');
    // None of the raw matcher strings should be the literal '/login' string
    const hasLoginLiteral = config.matcher.some((m: string) => m === '/login');
    expect(hasLoginLiteral).toBe(false);
  });

  it('matcher negative lookahead excludes /api/auth routes', () => {
    jest.resetModules();
    jest.mock('@/lib/auth', () => ({ auth: mockAuth }));
    jest.mock('@/lib/paths', () => ({ get BASE_PATH() { return pathsMock.BASE_PATH; } }));
    jest.mock('next/server', () => ({
      NextResponse: { redirect: mockRedirect, next: mockNext },
    }));

    const { config } = require('../../middleware');
    // The combined matcher pattern should contain a negative lookahead for api/auth
    const allPatterns = config.matcher.join(' ');
    expect(allPatterns).toContain('api/auth');
  });
});
