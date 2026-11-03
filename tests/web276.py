# The web version: the service worker installs (with ?sw=1 on localhost), precaches the app, and the app then
# starts, computes and opens a module with the network off. Run after: node core-build/web/precache.js
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE + '/index.html?sw=1'); await pg.wait_for_function("window.__app && __app.page")
        await pg.wait_for_function("navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true)", timeout=60000)
        await pg.wait_for_function("navigator.serviceWorker.ready.then((r) => r.active && r.active.state === 'activated')", timeout=60000)
        n = await pg.evaluate("caches.keys().then(async (k) => { let t = 0; for (const x of k) t += (await (await caches.open(x)).keys()).length; return k.join(',') + ' ' + t; })")
        print('cache:', n)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_function("window.__app && __app.page", timeout=30000); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("__app.cas.batch(['factor(x^2-1)', 'evalf(sqrt(2))'])")
        print('offline CAS:', r)
        await pg.evaluate("__app.addPage('module', { id: 'compsci' })"); await pg.wait_for_timeout(800)
        print('offline module tab:', await pg.locator('.page:not([hidden]) .md-secs .chip').count(), 'sections')
        r = await pg.evaluate("fetch('docs/guide.md').then((r) => r.ok).catch(() => false)")
        print('offline guide:', r)
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
