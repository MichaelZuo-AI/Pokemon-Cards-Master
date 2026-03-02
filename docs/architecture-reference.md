# Next.js 14 + Auth.js + Vercel — Architecture Reference

> Reusable patterns extracted from **Pokemon Cards Master**.
> Copy the relevant sections when bootstrapping a new project.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Auth System (NextAuth.js v5 + Google OAuth)](#2-auth-system)
3. [Vercel + basePath Deployment](#3-vercel--basepath-deployment)
4. [Centralized Path Management](#4-centralized-path-management)
5. [Middleware Auth Gate](#5-middleware-auth-gate)
6. [Per-User Daily Quota (Vercel KV)](#6-per-user-daily-quota-vercel-kv)
7. [PWA Setup (Dynamic Manifest + Service Worker)](#7-pwa-setup)
8. [API Route Patterns](#8-api-route-patterns)
9. [Testing Strategy](#9-testing-strategy)
10. [E2E Smoke Testing](#10-e2e-smoke-testing)
11. [Environment Variables](#11-environment-variables)
12. [Common Pitfalls & Solutions](#12-common-pitfalls--solutions)

---

## 1. Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Auth handlers (GET + POST)
│   │   ├── quota/                # Quota check endpoint
│   │   └── <feature>/            # Feature API routes
│   ├── manifest.webmanifest/     # Dynamic PWA manifest (route handler)
│   ├── sw.js/                    # Dynamic service worker (route handler)
│   ├── login/                    # Public login page
│   ├── layout.tsx                # Root layout (SessionProvider, SW registration)
│   └── page.tsx                  # Main app page (auth required)
├── components/                   # React components
├── hooks/                        # Custom React hooks
├── lib/
│   ├── auth.ts                   # NextAuth config (single source of truth)
│   ├── paths.ts                  # basePath helpers (single source of truth)
│   ├── quota.ts                  # Quota logic (Vercel KV + in-memory fallback)
│   └── <utilities>.ts
├── types/                        # TypeScript definitions
└── middleware.ts                 # Auth gate (redirects unauthenticated users)
```

**Principles:**
- `src/lib/` = server-side utilities, shared logic
- `src/hooks/` = client-side state machines
- Tests live next to source: `__tests__/` directories at each level
- Route handlers for dynamic content that needs server-side values (manifest, SW)

---

## 2. Auth System

### Stack
- **NextAuth.js v5** (Auth.js) — `next-auth@5.0.0-beta.30`
- **Google OAuth** provider
- **JWT** session strategy (no database needed)

### Core Config — `src/lib/auth.ts`

```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { BASE_PATH } from '@/lib/paths';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // CRITICAL for basePath deployments
  basePath: `${BASE_PATH}/api/auth`,
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
```

### Auth Route Handler — `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

// Vercel strips basePath from request.url, but Auth.js needs it
// for route matching. Re-add basePath before Auth.js processes it.
function patchUrl(req: NextRequest): NextRequest {
  if (!BASE_PATH) return req;
  const url = new URL(req.url);
  if (!url.pathname.startsWith(BASE_PATH)) {
    const patchedUrl = `${url.origin}${BASE_PATH}${url.pathname}${url.search}`;
    if (process.env.NODE_ENV === 'development') {
      console.debug('[auth] Patching URL:', url.pathname, '->', `${BASE_PATH}${url.pathname}`);
    }
    return new NextRequest(new Request(patchedUrl, req));
  }
  return req;
}

export async function GET(req: NextRequest) {
  return handlers.GET(patchUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(patchUrl(req));
}
```

### Why `patchUrl` is Needed

| Layer | What happens to URL |
|-------|-------------------|
| Browser requests | `https://domain.com/Pokemon/cardsmaster/api/auth/csrf` |
| Vercel routing | Strips basePath → handler receives `/api/auth/csrf` |
| Auth.js expects | `AUTH_URL + basePath + /api/auth/csrf` for route matching |
| **Without patch** | Auth.js can't match routes → "Bad request." error |
| **With patch** | URL restored → Auth.js works correctly |

### Login Page — `src/app/login/page.tsx`

```typescript
'use client';
import { signIn } from 'next-auth/react';
import { BASE_PATH } from '@/lib/paths';

export default function LoginPage() {
  return (
    <button onClick={() => signIn('google', { callbackUrl: BASE_PATH || '/' })}>
      Sign in with Google
    </button>
  );
}
```

### SessionProvider Setup — `src/app/layout.tsx`

```typescript
import { SessionProvider } from 'next-auth/react';
import { BASE_PATH } from '@/lib/paths';

// CRITICAL: basePath must match Auth.js config
<SessionProvider basePath={`${BASE_PATH}/api/auth`}>
  {children}
</SessionProvider>
```

### Google Cloud Console Setup

1. Create OAuth 2.0 Client ID (Web application)
2. Authorized redirect URI: `https://your-domain.com/<basePath>/api/auth/callback/google`
3. Set app to "External" (not "Internal") if users outside your org need access
4. Add test users if app is in "Testing" publishing status

### Type Augmentation — `src/types/next-auth.d.ts`

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
```

---

## 3. Vercel + basePath Deployment

### next.config.js

```javascript
const basePath = '/Pokemon/cardsmaster';  // <-- single definition
const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_BUILD_ID: new Date().toISOString().slice(0, 19).replace(/\D/g, ''),
  },
};
module.exports = nextConfig;
```

### Vercel Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `AUTH_SECRET` | `npx auth secret` | Required by Auth.js |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | |
| `AUTH_URL` | `https://your-domain.com/basePath` | Include basePath! |
| `KV_REST_API_URL` | Auto-set when KV linked | For quota system |
| `KV_REST_API_TOKEN` | Auto-set when KV linked | |

### Key Insight: Vercel Strips basePath

Inside route handlers on Vercel, `request.url` does NOT include basePath.
This breaks Auth.js, which compares URLs against `AUTH_URL`.

**Solution**: Patch URLs in the auth route handler (see Section 2).

---

## 4. Centralized Path Management

### `src/lib/paths.ts` — Single Source of Truth

```typescript
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function apiPath(route: string): string {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  return `${BASE_PATH}${normalized}`;
}
```

### Usage Everywhere

```typescript
// In hooks (client-side fetch)
import { apiPath } from '@/lib/paths';
const res = await fetch(apiPath('/api/tts'), { method: 'POST', body });

// In components (callbackUrl, links)
import { BASE_PATH } from '@/lib/paths';
signIn('google', { callbackUrl: BASE_PATH || '/' });

// In layout (SessionProvider, SW registration)
<SessionProvider basePath={`${BASE_PATH}/api/auth`}>
```

### Rule: Only 1 Place Defines the String

`next.config.js` defines `basePath = '/Pokemon/cardsmaster'`.
Everything else reads from `NEXT_PUBLIC_BASE_PATH` via `paths.ts`.

---

## 5. Middleware Auth Gate

### `src/middleware.ts`

```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

export default auth((req) => {
  if (!req.auth) {
    // CRITICAL: Explicit BASE_PATH — NextAuth auth() wrapper loses
    // Next.js basePath context for req.nextUrl
    const url = new URL(`${BASE_PATH}/login`, req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',
    '/((?!login|api/auth|_next|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icons).*)',
  ],
};
```

### Matcher Pattern Explained

- `'/'` — Explicit root (regex pattern doesn't match empty path after `/`)
- Negative lookahead excludes: login page, auth API, Next.js internals, static PWA files
- Auth API (`api/auth`) must be public for OAuth flow to work
- Static assets (manifest, SW, icons) must be public for PWA installation

---

## 6. Per-User Daily Quota (Vercel KV)

### `src/lib/quota.ts`

```typescript
export const DAILY_LIMIT = 1000;

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

function getKSTDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function makeKey(userId: string): string {
  return `quota:scan:${userId}:${getKSTDateString()}`;
}

const memoryStore = new Map<string, number>();

async function getKV() {
  if (!process.env.KV_REST_API_URL) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

// Atomic consume — use this instead of check-then-consume to prevent races
export async function consumeQuota(userId: string): Promise<QuotaStatus> {
  const key = makeKey(userId);
  const kvStore = await getKV();

  let used: number;
  if (kvStore) {
    used = await kvStore.incr(key);  // Atomic increment
    if (used === 1) {
      await kvStore.expire(key, 48 * 60 * 60);  // 48h TTL
    }
  } else {
    used = (memoryStore.get(key) ?? 0) + 1;
    memoryStore.set(key, used);
  }

  return {
    allowed: used <= DAILY_LIMIT,
    used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
  };
}
```

### Key Design Decisions

- **Atomic consume**: Use `INCR` (atomic in Redis) instead of separate check-then-consume to prevent TOCTOU races
- **In-memory fallback**: `Map<string, number>` for local dev without KV
- **48h TTL**: Covers date boundary edge cases (timezone drift)
- **Timezone**: KST (Asia/Seoul) for date key — customize per user base
- **Export `DAILY_LIMIT`**: Tests import the constant to prevent drift

### Usage in API Route

```typescript
// Consume atomically before expensive operation
const quota = await consumeQuota(session.user.id);
if (!quota.allowed) {
  return NextResponse.json({ error: 'Quota exceeded', quota }, { status: 429 });
}
// Proceed with expensive API call...
return NextResponse.json({ result, quota });
```

---

## 7. PWA Setup

### Dynamic Manifest — `src/app/manifest.webmanifest/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

export function GET() {
  return NextResponse.json({
    name: 'App Name',
    short_name: 'App',
    start_url: BASE_PATH || '/',
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  }, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
```

### Dynamic Service Worker — `src/app/sw.js/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

const BUILD_ID = process.env.NEXT_BUILD_ID || Date.now().toString();

export function GET() {
  const body = `
const CACHE_NAME = 'app-${BUILD_ID}';
const BASE_PATH = '${BASE_PATH}';
const APP_SHELL = [BASE_PATH + '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // CRITICAL: Skip navigation requests — otherwise auth redirects break
  if (event.request.method !== 'GET' ||
      event.request.url.includes('/api/') ||
      event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
`.trimStart();

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': BASE_PATH || '/',
    },
  });
}
```

### Why Route Handlers Instead of Static Files

| Approach | Problem |
|----------|---------|
| `public/manifest.json` | Hardcoded paths, can't read env vars |
| `src/app/manifest.ts` (convention) | Next.js auto-injects `<link>` WITHOUT basePath (bug) |
| **Route handler** | Full control, reads `BASE_PATH`, auto cache-busting |

### SW Registration in Layout

```typescript
// Use JSON.stringify for XSS protection in dangerouslySetInnerHTML
<script dangerouslySetInnerHTML={{ __html: `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(${JSON.stringify(`${BASE_PATH}/sw.js`)}).catch(() => {});
    });
  }
`}} />
```

### SW + Auth Redirects Pitfall

Service workers **cannot** return redirected responses for navigation requests.
If your middleware returns a 307 redirect and the SW intercepts it, the browser gets `ERR_FAILED`.

**Fix**: Always skip `event.request.mode === 'navigate'` in the SW fetch handler.

---

## 8. API Route Patterns

### Protected API Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { consumeQuota } from '@/lib/quota';

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Quota check (atomic)
  const quota = await consumeQuota(session.user.id);
  if (!quota.allowed) {
    return NextResponse.json({ error: 'Rate limited', quota }, { status: 429 });
  }

  // 3. Input validation
  let body: { input?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // 4. Business logic
  try {
    const result = await doExpensiveWork(body.input);
    return NextResponse.json({ result, quota });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Parsing LLM JSON Output

```typescript
function extractJSON(text: string): string {
  // 1. Try markdown code fences first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Try non-greedy (avoids capturing trailing garbage)
  const lazyMatch = text.match(/\{[\s\S]*?\}/);
  if (lazyMatch) {
    try {
      JSON.parse(lazyMatch[0]);
      return lazyMatch[0];
    } catch {
      // Fall through to greedy (handles nested braces)
      const greedyMatch = text.match(/\{[\s\S]*\}/);
      if (greedyMatch) return greedyMatch[0];
    }
  }

  return text;
}
```

---

## 9. Testing Strategy

### Structure

```
297 unit tests across 27 test suites:
├── API routes         47 tests  (auth, quota, recognize-card, tts, manifest)
├── Hooks              88 tests  (useCardRecognition, useSpeechSynthesis, useQuota, useAuth)
├── Components         27 tests  (CardResult, CardScanner, ScanHistory, SpeakButton)
├── Utilities          72 tests  (imageResize, storage, paths, quota)
├── Auth & middleware   42 tests  (auth route patchUrl, middleware gate, manifest route)
├── Integration         6 tests  (basePath across hooks)
└── E2E smoke          25 checks (curl-based, see Section 10)
```

### Key Testing Patterns

**basePath in tests** — `jest.setup.js` sets `NEXT_PUBLIC_BASE_PATH=''` so all tests use `/api/*` paths without prefix.

**Mock quota constant** — Export `DAILY_LIMIT` and import in tests to prevent hardcoded values drifting:

```typescript
import { consumeQuota, DAILY_LIMIT } from '../quota';
expect(result.limit).toBe(DAILY_LIMIT);
expect(result.remaining).toBe(DAILY_LIMIT - 3);
```

**Auth route patchUrl testing** — Test with and without `BASE_PATH`:

```typescript
// No basePath: passthrough
process.env.NEXT_PUBLIC_BASE_PATH = '';
// Request passes through unchanged

// With basePath: Vercel-stripped URL gets prefix re-added
process.env.NEXT_PUBLIC_BASE_PATH = '/app';
// /api/auth/csrf → /app/api/auth/csrf
```

---

## 10. E2E Smoke Testing

### `scripts/e2e-smoke.sh`

Automated curl-based checks for the production user flow. Run against live deployment:

```bash
./scripts/e2e-smoke.sh                          # default: your-domain.com
./scripts/e2e-smoke.sh https://custom-domain.com
```

### Test Categories (25 checks)

| Category | What it verifies |
|----------|-----------------|
| Auth Gate | Unauthenticated users get 307 → /login |
| Login Page | Returns 200, has sign-in button |
| OAuth Flow | CSRF token works, POST redirects to Google, redirect_uri includes basePath |
| API Protection | /api/quota, /api/recognize-card, /api/tts all require auth (307) |
| PWA Manifest | Returns 200, has app name, basePath in start_url and icons |
| HTML Meta | Manifest link, SW registration, SessionProvider all include basePath |
| Static Assets | sw.js and icons return 200 |

### Key Pattern: `assert_contains` with Literal Matching

```bash
# Use grep -qF (Fixed string) not grep -q (regex) to avoid false matches
assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    pass "$label"
  else
    fail "$label" "missing '$needle'"
  fi
}
```

---

## 11. Environment Variables

### `.env.example`

```bash
# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLOUD_TTS_API_KEY=your_google_cloud_tts_api_key_here

# NextAuth.js (run `npx auth secret` to generate)
AUTH_SECRET=your_auth_secret_here
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret

# Auth.js URL — include basePath for production deployments
AUTH_URL=https://your-domain.com/basePath

# Vercel KV (auto-populated when linked in Vercel dashboard)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### What Goes Where

| Variable | Local `.env.local` | Vercel Dashboard | Notes |
|----------|-------------------|------------------|-------|
| `AUTH_SECRET` | Yes | Yes | Same value both places |
| `AUTH_GOOGLE_ID` | Yes | Yes | |
| `AUTH_GOOGLE_SECRET` | Yes | Yes | |
| `AUTH_URL` | Optional | **Required** | Must include basePath |
| `GEMINI_API_KEY` | Yes | Yes | |
| `KV_REST_API_*` | No (use in-memory) | Auto-populated | Link KV store in Vercel |

---

## 12. Common Pitfalls & Solutions

### Vercel Strips basePath from request.url

**Symptom**: Auth.js returns "Bad request." on all routes.
**Cause**: `request.url` in route handlers is `/api/auth/csrf` instead of `/basePath/api/auth/csrf`.
**Fix**: Patch URLs in auth route handler (see Section 2).

### NextAuth auth() Middleware Loses basePath Context

**Symptom**: Middleware redirects to `/login` instead of `/basePath/login`.
**Cause**: The `auth()` wrapper creates a new request context without Next.js basePath.
**Fix**: Construct redirect URL explicitly: `new URL(\`${BASE_PATH}/login\`, req.nextUrl.origin)`.

### Service Worker Blocks Auth Redirects

**Symptom**: `ERR_FAILED` on page load; works in incognito.
**Cause**: SW intercepts navigation request, gets 307, can't return redirected response.
**Fix**: Skip `event.request.mode === 'navigate'` in SW fetch handler.

### Old Service Worker Cached in Browser

**Symptom**: App broken even after deploying fix; incognito works fine.
**Cause**: Chicken-and-egg — page can't load so new SW can't install.
**Fix**: User must manually unregister via DevTools > Application > Service Workers.
**Prevention**: Include build ID in cache name for automatic busting.

### Next.js manifest.ts Convention Ignores basePath

**Symptom**: `<link rel="manifest" href="/manifest.webmanifest">` (missing basePath prefix).
**Cause**: Next.js auto-injects the link tag without prepending basePath (framework bug).
**Fix**: Use route handler at `src/app/manifest.webmanifest/route.ts` + explicit `manifest:` in metadata.

### NextRequest Constructor Doesn't Transfer Body/Cookies

**Symptom**: POST to auth signin returns 500.
**Cause**: `new NextRequest(url, { method, headers })` doesn't copy the request body.
**Fix**: Use `new NextRequest(new Request(patchedUrl, originalRequest))` — standard Request clone pattern.

### dangerouslySetInnerHTML XSS with Env Vars

**Symptom**: Potential script injection if env var contains `');alert(1);//`.
**Cause**: String interpolation inside inline `<script>` without escaping.
**Fix**: Use `JSON.stringify()` for values injected into JavaScript context.

---

## Quick Start Checklist for New Projects

1. [ ] Set up `next.config.js` with `basePath` and `NEXT_PUBLIC_BASE_PATH` env
2. [ ] Create `src/lib/paths.ts` (copy Section 4)
3. [ ] Create `src/lib/auth.ts` with `basePath` config (copy Section 2)
4. [ ] Create auth route handler with `patchUrl` (copy Section 2)
5. [ ] Create `src/middleware.ts` with explicit `BASE_PATH` redirect (copy Section 5)
6. [ ] Create `src/app/login/page.tsx` with `callbackUrl: BASE_PATH || '/'`
7. [ ] Set up `SessionProvider` in layout with `basePath` prop
8. [ ] Create dynamic manifest + SW route handlers (copy Section 7)
9. [ ] Register SW in layout with `JSON.stringify` XSS protection
10. [ ] Add `AUTH_URL` (with basePath) to Vercel environment variables
11. [ ] Add OAuth redirect URI in Google Cloud Console (include basePath)
12. [ ] Run e2e smoke test script against deployment
