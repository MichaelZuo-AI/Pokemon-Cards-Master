# Pokemon Cards Master

PWA that recognizes Pokemon cards via camera/photo and displays card info in Simplified Chinese with voice readback.

## Quick Start

```bash
npm install && cp .env.example .env.local  # add GEMINI_API_KEY
npm test        # 43 tests
npm run dev     # dev server :3000
npm run build   # production build
```

## Stack

- Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- `@google/genai` v1.5.0 → Gemini 3 Flash (vision API)
- Google Cloud TTS (Chirp3-HD cmn-CN-Chirp3-HD-Zephyr) with browser SpeechSynthesis fallback
- LocalStorage for scan history (max 50 records)
- Jest 30 + React Testing Library

## Architecture

| Layer | Key File | Purpose |
|-------|----------|---------|
| API | `src/app/api/recognize-card/route.ts` | Gemini vision → structured Chinese card info |
| Hooks | `src/hooks/useCardRecognition.ts` | Image resize + API call state machine |
| Hooks | `src/hooks/useSpeechSynthesis.ts` | Google Cloud TTS + browser fallback |
| Utils | `src/lib/imageResize.ts` | Canvas resize to 1024px JPEG + thumbnails |
| Utils | `src/lib/storage.ts` | LocalStorage CRUD for scan history |
| UI | `src/app/page.tsx` | Main page with scanner/result/history views |

## Conventions

- All UI text in Simplified Chinese
- API route requires `X-App-Source: pokemon-cards-master` header
- Image sent as raw base64 (data URI prefix stripped)
- Vision model: `gemini-3-flash` (billing enabled, 1K req/min)
