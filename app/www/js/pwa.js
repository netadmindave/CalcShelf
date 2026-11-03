/*
 * pwa.js — the web version: register the service worker for offline use. Not in the Android app (its shell serves
 * the files itself) or a local copy (unless ?sw=1, for testing). Part of CalcShelf, GPL-3.0-or-later.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || window.TiBridge || location.hostname === 'appassets.androidplatform.net') return;
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (local ? !/[?&]sw=1\b/.test(location.search) : location.protocol !== 'https:') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch((e) => console.warn('offline copy not available', e)); });
})();
