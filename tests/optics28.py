# 2.8 optics tools: Δν↔Δλ, Gaussian beam / ABCD, dispersion, etalon, thin film.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(300)
        await pg.locator('.page.conv .seg button', has_text='Optics').first.tap(); await pg.wait_for_timeout(300)
        print('lw main:', (await pg.locator('.page.conv .cv-row.main').inner_text()).split('\n')[0])
        card = lambda: pg.locator('.page.conv .dt-card').first.inner_text()
        for tool in ['Beam', 'Dispersion', 'Etalon', 'Thin film']:
            await pg.locator('.page.conv .seg-wrap button', has_text=tool).tap(); await pg.wait_for_timeout(500)
            print('==', tool, '|', (await card()).replace('\n', ' | ')[:520])
            await pg.screenshot(path='out/optics_'+tool.split()[0].lower()+'.png', full_page=True)
        # thin film: quarter-wave mirror preset
        await pg.locator('.page.conv select[aria-label="Preset"]').select_option(label='Quarter-wave mirror (HL)⁵H, TiO₂/SiO₂'); await pg.wait_for_timeout(400)
        print('mirror:', (await card()).replace('\n',' | ')[:200])
        print('errors', errs)
        await b.close()
asyncio.run(main())
