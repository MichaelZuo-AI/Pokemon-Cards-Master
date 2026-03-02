import { NextResponse } from 'next/server';
import { BASE_PATH } from '@/lib/paths';

// Build-time timestamp ensures cache busts on each deployment
const BUILD_ID = process.env.NEXT_BUILD_ID || Date.now().toString();

export function GET() {
  const body = `
const CACHE_NAME = 'pokemon-cards-${BUILD_ID}';
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
  // Skip API calls, non-GET requests, and navigation requests (auth redirects break otherwise)
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.mode === 'navigate') {
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
