// VehicleSymptoms offline support. build.js fills in BUILD_ID and the page lists.
// Pages: try the network first so drivers always get the newest advice; fall back to the saved copy.
// Scripts, styles and images: use the saved copy and refresh it in the background.
'use strict';
const BUILD_ID = '__BUILD_ID__';
const CORE = __CORE__;          // small: app shell, needed for any page to work offline
const OFFLINE_PAGES = __PAGES__; // warning lights and roadside symptom guides
const CORE_CACHE = 'vs-core-' + BUILD_ID; // replaced on every deploy
const PAGE_CACHE = 'vs-pages';            // kept across deploys; pages refresh when visited or after a week
const RUNTIME = 'vs-runtime';             // other pages and files a visitor opened
const MAX_RUNTIME = 80;
const MAX_PAGE_AGE = 7 * 24 * 3600 * 1000;
const NETWORK_TIMEOUT = 4000;
const OFFLINE_SET = new Set(OFFLINE_PAGES);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    await core.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    // Save the offline pages that are missing or more than a week old. One failure doesn't stop the rest.
    const pages = await caches.open(PAGE_CACHE);
    for (const url of OFFLINE_PAGES) {
      try {
        const have = await pages.match(url);
        const age = have ? Date.now() - new Date(have.headers.get('date') || 0).getTime() : Infinity;
        if (have && age < MAX_PAGE_AGE) continue;
        const res = await fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
        if (res.ok) await pages.put(url, res);
      } catch (e) { /* offline: try again on the next update */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([CORE_CACHE, PAGE_CACHE, RUNTIME]);
    for (const key of await caches.keys()) if (key.startsWith('vs-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trim() {
  const cache = await caches.open(RUNTIME);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await cache.delete(keys[i]);
}

function save(request, res) {
  const url = new URL(request.url);
  const copy = res.clone();
  if (url.origin === self.location.origin && OFFLINE_SET.has(url.pathname)) {
    return caches.open(PAGE_CACHE).then(c => c.put(url.pathname, copy));
  }
  return caches.open(RUNTIME).then(c => c.put(request, copy)).then(trim);
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function page(event) {
  const request = event.request;
  try {
    const res = await Promise.race([fetch(request), timeout(NETWORK_TIMEOUT)]);
    if (res && res.ok && res.type === 'basic') event.waitUntil(save(request, res).catch(() => {}));
    return res;
  } catch (e) {
    const path = new URL(request.url).pathname;
    const saved = (await caches.match(path, { ignoreSearch: true })) || (await caches.match(request, { ignoreSearch: true }));
    if (saved) return saved;
    return (await caches.match('/offline/')) || Response.error();
  }
}

async function asset(event) {
  const request = event.request;
  const saved = await caches.match(request);
  const fresh = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) event.waitUntil(save(request, res).catch(() => {}));
    return res;
  });
  if (saved) {
    event.waitUntil(fresh.catch(() => {}));
    return saved;
  }
  return fresh;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/') || url.pathname === '/sw.js')) return;
  if (req.mode === 'navigate') {
    if (sameOrigin) event.respondWith(page(event));
    return;
  }
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (sameOrigin || fonts) event.respondWith(asset(event));
});
