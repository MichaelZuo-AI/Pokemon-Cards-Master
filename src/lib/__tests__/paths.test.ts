describe('paths', () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    // Restore the env var and clear the module registry so each test gets
    // a freshly-evaluated module with its own captured BASE_PATH constant.
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalEnv;
    }
    jest.resetModules();
  });

  // ── BASE_PATH constant ──────────────────────────────────────────────────

  describe('BASE_PATH constant', () => {
    it('equals the env var when it is set', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/Pokemon/cardsmaster';
      const { BASE_PATH } = require('../paths');
      expect(BASE_PATH).toBe('/Pokemon/cardsmaster');
    });

    it('equals empty string when the env var is an empty string', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '';
      const { BASE_PATH } = require('../paths');
      expect(BASE_PATH).toBe('');
    });

    it('defaults to empty string when the env var is undefined', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      const { BASE_PATH } = require('../paths');
      expect(BASE_PATH).toBe('');
    });
  });

  // ── apiPath ─────────────────────────────────────────────────────────────

  describe('apiPath', () => {
    it('prepends basePath to a route when basePath is set', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/Pokemon/cardsmaster';
      const { apiPath } = require('../paths');
      expect(apiPath('/api/tts')).toBe('/Pokemon/cardsmaster/api/tts');
    });

    it('returns route unchanged when basePath is an empty string', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '';
      const { apiPath } = require('../paths');
      expect(apiPath('/api/tts')).toBe('/api/tts');
    });

    it('returns route unchanged when env var is undefined (defaults to empty string)', () => {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
      const { apiPath } = require('../paths');
      expect(apiPath('/api/recognize-card')).toBe('/api/recognize-card');
    });

    it('works correctly for all three app routes (/api/tts, /api/recognize-card, /api/quota)', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/base';
      const { apiPath } = require('../paths');
      expect(apiPath('/api/tts')).toBe('/base/api/tts');
      expect(apiPath('/api/recognize-card')).toBe('/base/api/recognize-card');
      expect(apiPath('/api/quota')).toBe('/base/api/quota');
    });

    it('works with a route that has no leading slash (concatenates literally)', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/base';
      const { apiPath } = require('../paths');
      // No leading slash — the function does pure string concat, no normalization
      expect(apiPath('api/tts')).toBe('/baseapi/tts');
    });

    it('returns empty string when both basePath and route are empty strings', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '';
      const { apiPath } = require('../paths');
      expect(apiPath('')).toBe('');
    });

    it('handles a basePath without a trailing slash correctly (no double slash)', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/myapp';
      const { apiPath } = require('../paths');
      // /myapp + /api/tts → /myapp/api/tts (no double slash)
      expect(apiPath('/api/tts')).toBe('/myapp/api/tts');
      expect(apiPath('/api/tts')).not.toContain('//');
    });
  });
});
