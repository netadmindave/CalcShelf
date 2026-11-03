/*
 * sw.js — the service worker of the web version (GitHub Pages), so CalcShelf works offline once it has been opened.
 * The Android app doesn't use it. The deploy writes the version and precache.json (the app's own files; each
 * emulator is cached the first time it is opened). Part of CalcShelf, GPL-3.0-or-later.
 */
'use strict';
const VERSION = 'dev';
const CACHE = 'calcshelf-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    let list = ['./', 'index.html'];
    try { const r = await fetch('precache.json', { cache: 'no-store' }); if (r.ok) list = list.concat(await r.json()); } catch (x) { /* a local copy has no list */ }
    // one file at a time, so a single failure doesn't stop the rest
    for (const u of list) { try { await c.add(new Request(u, { cache: 'reload' })); } catch (x) { /* fetched again when used */ } }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('calcshelf-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// pages: the network first (so an update shows), the cache when offline; everything else: the cache first
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate' || /\.html?$|\/$/.test(new URL(req.url).pathname) || /precache\.json$|guide\.md$/.test(req.url);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (page) {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch (x) { return (await c.match(req, { ignoreSearch: true })) || Response.error(); }
    }
    const hit = await c.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && r.type === 'basic') c.put(req, r.clone());
    return r;
  })());
});
