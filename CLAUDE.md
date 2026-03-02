# Pokemon Cards Master

PWA that recognizes Pokemon cards via camera/photo and displays card info in Simplified Chinese with voice readback.

## Quick Start

```bash
npm install && cp .env.example .env.local  # add GEMINI_API_KEY + auth vars
npm test        # 221 tests
npm run dev     # dev server :3000
npm run build   # production build
```

## Stack

- Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- `@google/genai` v1.5.0 → Gemini 2.5 Flash (vision API)
- Google Cloud TTS (Standard cmn-CN-Standard-A) with browser SpeechSynthesis fallback
- NextAuth.js v5 (Auth.js) → Google OAuth, JWT sessions
- Vercel KV (Redis) → per-user daily scan quota (10/day)
- LocalStorage for scan history (max 50 records)
- Jest 30 + React Testing Library

## Architecture

| Layer | Key File | Purpose |
|-------|----------|---------|
| Auth | `src/lib/auth.ts` | NextAuth.js config (Google provider, JWT) |
| Auth | `src/middleware.ts` | Route protection (redirects to /login) |
| Quota | `src/lib/quota.ts` | Per-user daily quota with Vercel KV + in-memory fallback |
| API | `src/app/api/recognize-card/route.ts` | Gemini vision → structured Chinese card info |
| API | `src/app/api/quota/route.ts` | Client quota check endpoint |
| Hooks | `src/hooks/useCardRecognition.ts` | Image resize + API call state machine |
| Hooks | `src/hooks/useSpeechSynthesis.ts` | Google Cloud TTS + browser fallback |
| Hooks | `src/hooks/useAuth.ts` | Session/sign-in/sign-out wrapper |
| Hooks | `src/hooks/useQuota.ts` | Fetch + cache quota state |
| Utils | `src/lib/imageResize.ts` | Canvas resize to 1024px JPEG + thumbnails |
| Utils | `src/lib/storage.ts` | LocalStorage CRUD for scan history |
| UI | `src/app/page.tsx` | Main page with scanner/result/history views |
| UI | `src/app/login/page.tsx` | Google sign-in page |

## Conventions

- All UI text in Simplified Chinese
- API routes require authenticated session (via NextAuth.js middleware)
- Image sent as raw base64 (data URI prefix stripped)
- Vision model: `gemini-2.5-flash` (billing enabled)
- Quota consumed only after successful Gemini call (failed calls don't count)
