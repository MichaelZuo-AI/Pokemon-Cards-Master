# Pokemon Cards Master

PWA that recognizes Pokemon cards via camera/photo and displays card info in Simplified Chinese with voice readback.

## Features

- Camera/photo Pokemon card recognition using Gemini 2.5 Flash vision API
- Structured card info display (name, type, HP, attacks, weakness, rarity, etc.)
- Voice readback via Google Cloud TTS with browser SpeechSynthesis fallback
- Scan history stored in LocalStorage (max 50 records)
- Mobile-first responsive design

## Tech Stack

- **Framework:** Next.js 14 App Router, React 18, TypeScript
- **Styling:** Tailwind CSS
- **Vision AI:** Gemini 2.5 Flash (`@google/genai`)
- **TTS:** Google Cloud TTS (Standard cmn-CN-Standard-A) on Vercel Edge Runtime
- **Testing:** Jest 30, React Testing Library (206 tests)
- **Deployment:** Vercel

## Getting Started

```bash
npm install
cp .env.example .env.local  # add GEMINI_API_KEY and GOOGLE_CLOUD_TTS_API_KEY
npm run dev                  # dev server :3000
npm test                     # 206 tests
npm run build                # production build
```

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini vision |
| `GOOGLE_CLOUD_TTS_API_KEY` | Google Cloud TTS API key for voice readback |

## Architecture

| Layer | Key File | Purpose |
|-------|----------|---------|
| API | `src/app/api/recognize-card/route.ts` | Gemini vision -> structured Chinese card info |
| API | `src/app/api/tts/route.ts` | Google Cloud TTS (Edge Runtime) |
| Hooks | `src/hooks/useCardRecognition.ts` | Image resize + API call state machine |
| Hooks | `src/hooks/useSpeechSynthesis.ts` | Cloud TTS + browser fallback with AbortController |
| Utils | `src/lib/imageResize.ts` | Canvas resize to 1024px JPEG + thumbnails |
| Utils | `src/lib/storage.ts` | LocalStorage CRUD for scan history |
| UI | `src/app/page.tsx` | Main page with scanner/result/history views |

## Changelog

### 2026-03-02

**Vision Model Optimization**
- Benchmarked Gemini 2.5 Flash (3.4s), 2.5 Pro (14.6s), 3 Flash Preview (unstable 503), 3 Pro Preview (224s)
- Selected `gemini-2.5-flash` for best speed/reliability tradeoff (~3s per recognition)

**Google Cloud TTS Integration**
- Replaced browser SpeechSynthesis with Google Cloud TTS REST API
- Voice: `cmn-CN-Standard-A` (~0.8s latency, benchmarked against Chirp3-HD at 3s and WaveNet at 1.4s)
- TTS route runs on Vercel Edge Runtime for near-zero cold starts
- SSML input with sentence splitting to handle sentence length limits
- Full XML entity escaping (`&`, `<`, `>`, `"`, `'`) in SSML builder
- Null guard on `audioContent` before base64 decoding
- Browser SpeechSynthesis as automatic fallback on any Cloud TTS failure

**Client-Side TTS Improvements**
- Added AbortController to cancel in-flight TTS fetches on rapid start/stop clicks
- Pre-create `Audio` element synchronously in click context for mobile gesture unlock
- Proper cleanup: abort fetch, pause audio, revoke objectURL on stop/unmount
- Fixed event listener leak (`voiceschanged` listener now removed on cleanup)

**Prompt Quality**
- Improved card introduction tone: natural and informative instead of childish
- TTS summary prompt: mature tone, no excessive exclamation marks or baby-talk particles

**Code Quality & Testing**
- 206 tests (up from 43 at project start)
- SSML sanitization tests (escaping, comma splitting, edge cases)
- extractJSON branch coverage (code fences, raw JSON, malformed responses)
- AbortController abort behavior tests (stop mid-fetch, intentional abort skip)
- objectURL cleanup tests (onended, stop, unmount)
- Browser TTS fallback utterance callback tests
- Null/undefined filtering in attacks array sanitization
- Edge runtime declaration test

### 2026-02-28

- Initial PWA implementation with camera/photo card recognition
- Gemini vision API integration with structured Chinese card info
- Browser SpeechSynthesis for voice readback
- LocalStorage scan history
- Mobile-first responsive UI with Tailwind CSS
