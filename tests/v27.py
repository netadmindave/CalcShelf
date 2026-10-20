import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
        await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(2500)
        # TI-36X Pro night display
        await pg.evaluate("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(800)
        await pg.evaluate("(() => { const p = __app.page.t36; p.setNight(true); })()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='out/v27_t36night.png')
        # several emulator tabs
        await pg.evaluate("__app.settings.multiEmu = true; __app.saveSettings && __app.saveSettings()")
        for model in ['48gx', '49gp']:
            await pg.evaluate("__app.emuChooser(false, null)"); await pg.wait_for_timeout(400)
            await pg.locator(f'[data-emu="hp:{model}"]').click(); await pg.wait_for_timeout(300)
            await pg.locator('.mi[data-act^="Open"]').click(); await pg.wait_for_timeout(4500)
        tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t=>t.textContent.trim()).filter(Boolean).join(' | ')")
        frames = [f for f in pg.frames if '/hp/' in f.url]
        bgf = next(f for f in frames if '48gx' in f.url)
        t0 = await bgf.evaluate("__hp.core().x.hp_vtime()"); await pg.wait_for_timeout(3000); t1 = await bgf.evaluate("__hp.core().x.hp_vtime()")
        print('tabs:', tabs, '| background 48GX advanced', round((t1 - t0) / 1e6, 2), 's of emulated time in 3 s')
        # HP display styles work
        fg = next(f for f in frames if '49gp' in f.url)
        await fg.locator('#btn-menu').click(); await pg.wait_for_timeout(300)
        print('HP menu rows:', await fg.evaluate("[...document.querySelectorAll('#sheet-menu .row span, #sheet-menu .toggle span')].map(x=>x.textContent).join(' | ')"))
        await fg.locator('#s-lcd button[data-v="night"]').click(); await fg.locator('#scrim').click(force=True); await pg.wait_for_timeout(800)
        await pg.screenshot(path='out/v27_hpnight.png')
        print('errors', errs[-5:])
        await b.close()
asyncio.run(main())
