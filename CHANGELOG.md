# Changelog

## 2026-03-02 — basePath Centralization & Production Hardening

### Highlights

- **Centralized basePath management**: Reduced basePath definitions from 12+ scattered locations to a single `src/lib/paths.ts` module. All client code now imports `BASE_PATH` and `apiPath()` instead of reading `process.env.NEXT_PUBLIC_BASE_PATH` directly.
- **Solved Auth.js + Vercel basePath conflict**: Vercel strips `basePath` from `request.url` at runtime, but Auth.js needs it for route matching. Fixed by patching the request URL in the auth route handler before passing to Auth.js.
- **Dynamic PWA assets**: Both `manifest.webmanifest` and `sw.js` are now served via Next.js route handlers instead of static files, eliminating hardcoded paths and enabling automatic cache busting with build timestamps.
- **Atomic quota enforcement**: Replaced check-then-consume (TOCTOU race) with a single atomic `consumeQuota` call using Redis `INCR`, preventing concurrent requests from exceeding the daily limit.
- **Daily scan quota raised to 1,000** per user per day.
- **297 unit tests** (up from 224) with 42 new tests covering auth route handler, middleware, and manifest route.
- **25 automated e2e smoke checks** via `scripts/e2e-smoke.sh` covering auth gate, OAuth flow, API protection, PWA manifest, and static assets.

### Architecture Changes

| Before | After |
|--------|-------|
| `process.env.NEXT_PUBLIC_BASE_PATH` in 12+ files | `import { BASE_PATH, apiPath } from '@/lib/paths'` |
| Static `public/manifest.json` | Dynamic `src/app/manifest.webmanifest/route.ts` |
| Static `public/sw.js` with hardcoded basePath | Dynamic `src/app/sw.js/route.ts` with `BASE_PATH` import |
| `checkQuota()` then `consumeQuota()` (race-prone) | Single atomic `consumeQuota()` with INCR |
| Greedy JSON extraction `\{[\s\S]*\}` | Non-greedy first, greedy fallback |
| Manual UTC+9 date math | `toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })` |

### BasePath Definitions (now only 2 places)

1. `next.config.js` line 2: `const basePath = '/Pokemon/cardsmaster'`
2. Everything else reads from `NEXT_PUBLIC_BASE_PATH` env var via `src/lib/paths.ts`

### Security Fixes

- Fixed XSS surface in `layout.tsx`: SW registration path now uses `JSON.stringify()` inside `dangerouslySetInnerHTML`
- Fixed `extractJSON` greedy regex that could capture trailing garbage from LLM output
- `apiPath()` now normalizes missing leading slashes to prevent malformed URLs
- E2E smoke test uses `grep -qF` (literal match) instead of `grep -q` (regex)

### Auth Flow (Vercel + basePath)

The core challenge: Vercel strips `basePath` from `request.url` inside route handlers, but Auth.js compares `request.url` against `AUTH_URL` (which includes basePath) to match routes.

Solution:
1. `src/app/api/auth/[...nextauth]/route.ts` — `patchUrl()` re-adds basePath to the request URL before Auth.js processes it
2. `src/lib/auth.ts` — `basePath: '${BASE_PATH}/api/auth'` tells Auth.js where its routes live
3. `src/middleware.ts` — Explicit `BASE_PATH` in redirect URL (NextAuth `auth()` wrapper loses Next.js basePath context)

### Test Coverage

| Category | Tests |
|----------|-------|
| Hooks (useCardRecognition, useSpeechSynthesis, useQuota, useAuth) | 88 |
| API routes (recognize-card, tts, quota) | 47 |
| Utilities (imageResize, storage, paths, quota) | 72 |
| Components (page, login, tts-debug) | 27 |
| Auth & middleware (auth route, middleware, manifest) | 42 |
| Integration (basePath) | 6 |
| E2E smoke (curl-based) | 25 |
| **Total** | **297 unit + 25 e2e** |

### Commits

- `d94edaf` Centralize basePath into src/lib/paths.ts
- `ce631e4` Fix middleware root path match, manifest link basePath
- `7302acd` Replace manifest.ts convention with route handler
- `e5e6aa8` Fix SW blocking auth redirects: skip navigation requests
- `bcd7a59` Fix Auth.js + Vercel basePath: patch request URL
- `d50d808` Set Auth.js basePath to match patched request URL
- `0e27978` Fix middleware redirect: use explicit BASE_PATH
- `1b627cd` Fix auth POST: use Request clone to preserve body/cookies
- `20ce150` Add e2e smoke test script, remove debug endpoint
- `4238607` Increase daily scan quota from 10 to 1000
- `d0b8505` Apply review fixes and add 42 new unit tests
- `5ddd78c` Fix all remaining review issues
