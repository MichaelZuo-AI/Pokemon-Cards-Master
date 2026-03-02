/**
 * @jest-environment node
 *
 * Tests for src/app/manifest.webmanifest/route.ts
 *
 * The route exports a single GET() handler that returns a JSON PWA manifest.
 * Icon URLs include the current BASE_PATH; start_url falls back to '/' when
 * BASE_PATH is empty.
 *
 * Strategy:
 *   - Mock @/lib/paths so BASE_PATH can be controlled per-test via resetModules.
 *   - Re-require the route module after each BASE_PATH change.
 *   - Parse the JSON body and assert manifest fields directly.
 */

const pathsMock = { BASE_PATH: '' };

jest.mock('@/lib/paths', () => ({
  get BASE_PATH() { return pathsMock.BASE_PATH; },
}));

// next/server is available in node test environment via the Next.js jest preset.
// No additional mocking needed — NextResponse.json works normally in tests.

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Require a fresh copy of the route module (picks up current pathsMock.BASE_PATH). */
function requireRoute() {
  return require('../route') as { GET: () => Response };
}

/** Call GET() and parse the JSON body. */
async function getManifest(): Promise<Record<string, unknown>> {
  const { GET } = requireRoute();
  const response = GET();
  // NextResponse.json() returns a Response-compatible object
  return (response as unknown as Response).json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('manifest GET — static fields', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.resetModules();
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('returns HTTP 200', () => {
    const { GET } = requireRoute();
    const response = GET() as unknown as Response;
    expect(response.status).toBe(200);
  });

  it('sets Content-Type to application/manifest+json', () => {
    const { GET } = requireRoute();
    const response = GET() as unknown as Response;
    expect(response.headers.get('Content-Type')).toBe('application/manifest+json');
  });

  it('includes the Chinese app name', async () => {
    const manifest = await getManifest();
    expect(manifest.name).toBe('宝可梦卡牌大师');
  });

  it('includes the Chinese short_name', async () => {
    const manifest = await getManifest();
    expect(manifest.short_name).toBe('卡牌大师');
  });

  it('includes a description in Chinese', async () => {
    const manifest = await getManifest();
    expect(typeof manifest.description).toBe('string');
    expect((manifest.description as string).length).toBeGreaterThan(0);
  });

  it('sets display to standalone', async () => {
    const manifest = await getManifest();
    expect(manifest.display).toBe('standalone');
  });

  it('sets orientation to portrait', async () => {
    const manifest = await getManifest();
    expect(manifest.orientation).toBe('portrait');
  });

  it('sets background_color to #030712', async () => {
    const manifest = await getManifest();
    expect(manifest.background_color).toBe('#030712');
  });

  it('sets theme_color to #1a1a2e', async () => {
    const manifest = await getManifest();
    expect(manifest.theme_color).toBe('#1a1a2e');
  });

  it('includes exactly two icons', async () => {
    const manifest = await getManifest();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect((manifest.icons as unknown[]).length).toBe(2);
  });

  it('includes a 192x192 icon', async () => {
    const manifest = await getManifest();
    const icons = manifest.icons as Array<{ sizes: string; type: string; src: string }>;
    const icon192 = icons.find((i) => i.sizes === '192x192');
    expect(icon192).toBeDefined();
    expect(icon192!.type).toBe('image/png');
  });

  it('includes a 512x512 icon', async () => {
    const manifest = await getManifest();
    const icons = manifest.icons as Array<{ sizes: string; type: string; src: string }>;
    const icon512 = icons.find((i) => i.sizes === '512x512');
    expect(icon512).toBeDefined();
    expect(icon512!.type).toBe('image/png');
  });
});

describe('manifest GET — empty BASE_PATH', () => {
  beforeEach(() => {
    pathsMock.BASE_PATH = '';
    jest.resetModules();
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('sets start_url to / when BASE_PATH is empty', async () => {
    const manifest = await getManifest();
    // BASE_PATH is '' — the expression (BASE_PATH || '/') evaluates to '/'
    expect(manifest.start_url).toBe('/');
  });

  it('icon src paths start with /icons/ when BASE_PATH is empty', async () => {
    const manifest = await getManifest();
    const icons = manifest.icons as Array<{ src: string }>;
    expect(icons[0].src).toBe('/icons/icon-192.png');
    expect(icons[1].src).toBe('/icons/icon-512.png');
  });
});

describe('manifest GET — with BASE_PATH', () => {
  const BASE = '/Pokemon/cardsmaster';

  beforeEach(() => {
    pathsMock.BASE_PATH = BASE;
    jest.resetModules();
    jest.mock('@/lib/paths', () => ({
      get BASE_PATH() { return pathsMock.BASE_PATH; },
    }));
  });

  it('sets start_url to BASE_PATH when it is non-empty', async () => {
    const manifest = await getManifest();
    expect(manifest.start_url).toBe(BASE);
  });

  it('icon src paths are prefixed with BASE_PATH', async () => {
    const manifest = await getManifest();
    const icons = manifest.icons as Array<{ src: string }>;
    expect(icons[0].src).toBe(`${BASE}/icons/icon-192.png`);
    expect(icons[1].src).toBe(`${BASE}/icons/icon-512.png`);
  });

  it('does not double-prefix icon paths', async () => {
    const manifest = await getManifest();
    const icons = manifest.icons as Array<{ src: string }>;
    icons.forEach((icon) => {
      expect(icon.src).not.toContain(`${BASE}${BASE}`);
    });
  });
});
