import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
        # an old document with an HP-42S tab opens as the HP 48GX
        await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(2500)
        for model, label in [('48gx', 'HP 48GX'), ('49gp', 'HP 49g+')]:
            await pg.evaluate("__app.emuChooser()"); await pg.wait_for_timeout(500)
            await pg.locator(f'[data-emu="hp:{model}"]').click(); await pg.wait_for_timeout(400)
            await pg.locator('.mi[data-act^="Switch"], .mi[data-act^="Open"]').click(); await pg.wait_for_timeout(5000)
            tabs = await pg.evaluate("[...document.querySelectorAll('.tab')].map(t=>t.textContent.trim()).filter(Boolean).join(' | ')")
            fr = next(f for f in pg.frames if '/hp/' in f.url)
            ID = await fr.evaluate("__hp.ID")
            for k in ['7', 'ENTER', '6', '×']:
                await fr.locator(f'.key[data-id="{ID[k]}"]').click(); await pg.wait_for_timeout(300)
            await pg.wait_for_timeout(1200)
            await pg.screenshot(path=f'out/emuhp_{model}.png')
            print(model, 'tabs:', tabs, 'url', fr.url.split('/')[-1])
        print('errors', errs[-5:])
        await b.close()
asyncio.run(main())
