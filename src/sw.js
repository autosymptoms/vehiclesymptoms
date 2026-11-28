// VehicleSymptoms offline support. build.js fills in BUILD_ID and the page lists.
// Pages: try the network first so drivers always get the newest advice; fall back to the saved copy.
// Scripts, styles and images: use the saved copy and refresh it in the background.
'use strict';
const BUILD_ID = '__BUILD_ID__';
const CORE = __CORE__;          // small: app shell, needed for any page to work offline
const OFFLINE_PAGES = __PAGES__; // warning lights and roadside symptom guides
const CORE_CACHE = 'vs-core-' + BUILD_ID; // replaced on every deploy
const PAGE_CACHE = 'vs-pages-' + BUILD_ID; // offline guides, saved fresh for every version so fixed advice replaces old copies
const RUNTIME = 'vs-runtime';             // other pages and files a visitor opened
const MAX_RUNTIME = 80;
const NETWORK_TIMEOUT = 4000;
const OFFLINE_SET = new Set(OFFLINE_PAGES);
const CORE_SET = new Set(CORE);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    await core.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
    // Save every offline guide fresh from this version, so safety fixes reach installed phones.
    // Only a fresh, complete answer from the site is saved. If a page can't be fetched right now,
    // it is left out (it is saved next time it is opened online). A copy from an older version is
    // never carried forward into this version's cache as if it were current.
    const pages = await caches.open(PAGE_CACHE);
    for (const url of OFFLINE_PAGES) {
      try {
        const res = await fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
        if (isFresh(res)) await pages.put(url, res);
      } catch (e) { /* offline or interrupted: leave this page out */ }
    }
    await self.skipWaiting();
  })());
});

// A response worth saving as this version's copy: a full 200 answer from the site itself,
// not an opaque, redirected or partial one.
function isFresh(res) {
  return !!res && res.status === 200 && res.type === 'basic' && !res.redirected;
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Old versions' caches are deleted only once this version's core files are all saved.
    // (Activate runs only after install finished, so the page cache is complete too.)
    const core = await caches.open(CORE_CACHE);
    const coreReady = (await Promise.all(CORE.map(u => core.match(u)))).every(Boolean);
    const keep = new Set([CORE_CACHE, PAGE_CACHE, RUNTIME]);
    if (coreReady) for (const key of await caches.keys()) if (key.startsWith('vs-') && !keep.has(key)) await caches.delete(key);
    // Old copies of the site's own scripts and styles must never outlive a new version.
    // Saved copies of other pages are dropped too: a page saved before a fix must not be shown after it.
    const runtime = await caches.open(RUNTIME);
    for (const req of await runtime.keys()) {
      const path = new URL(req.url).pathname;
      if (CORE_SET.has(path) || path.endsWith('/') || !/\.[a-z0-9]+$/i.test(path)) await runtime.delete(req);
    }
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
    if (saved) return labelSaved(saved);
    return (await caches.match('/offline/')) || Response.error();
  }
}

// A saved page says it is saved, and how old it is, so nobody mistakes it for the live site.
async function labelSaved(res) {
  try {
    const html = await res.clone().text();
    const when = new Date(res.headers.get('date') || Date.now());
    const days = Math.floor((Date.now() - when.getTime()) / 86400000);
    const age = days < 1 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
    const note = '<div class="offline-note" role="note" style="background:#FFF4D6;color:#16222E;padding:10px 16px;font-size:14px;border-bottom:1px solid #E9D38A"><b>Saved copy (offline).</b> Saved ' + age + '. Advice may have been updated since. If a red light is on, or you see smoke, pull over when it’s safe and turn the engine off.</div>';
    const out = html.replace(/<main([^>]*)>/, m => note + m);
    const headers = new Headers(res.headers); headers.delete('content-length');
    return new Response(out, { status: 200, headers });
  } catch (e) { return res; }
}

async function asset(event) {
  const request = event.request;
  const url = new URL(request.url);
  // The site's own scripts and styles come from this version's saved set, so a page and its
  // styles always match. They change only when a new version of the site installs.
  if (url.origin === self.location.origin && CORE_SET.has(url.pathname)) {
    const core = await caches.open(CORE_CACHE);
    const hit = await core.match(url.pathname);
    if (hit) return hit;
    return fetch(request);
  }
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
