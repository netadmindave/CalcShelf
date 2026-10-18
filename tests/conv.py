# Conversion tool: unit dropdowns and the Optics tab's Δν ↔ Δλ converter.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(500)
        sel = pg.locator('.page.conv select')
        print('unit selects:', await sel.count(), 'from options:', await sel.nth(0).locator('option').count())
        await sel.nth(1).select_option('mi'); await pg.wait_for_timeout(200)
        print('1550 nm -> mi:', await pg.locator('.page.conv .cv-row.main').inner_text())
        await pg.locator('.page.conv .chip', has_text='Pressure / stress').tap(); await pg.wait_for_timeout(200)
        await sel.nth(0).select_option('psi'); await sel.nth(1).select_option('kPa'); await pg.wait_for_timeout(200)
        print('1550 psi -> kPa:', await pg.locator('.page.conv .cv-row.main').inner_text())
        await sel.nth(1).select_option('…other'); await pg.locator('[aria-label="Other to unit"]').fill('N/cm²'); await pg.wait_for_timeout(200)
        print('other unit:', await pg.locator('.page.conv .cv-row.main').inner_text())
        await pg.screenshot(path='out/conv_units.png')
        await pg.locator('.page.conv .seg button', has_text='Optics').tap(); await pg.wait_for_timeout(300)
        print('optics main:', await pg.locator('.page.conv .cv-row.main').inner_text())
        await pg.screenshot(path='out/conv_optics.png')
        # frequency centre, Δν in MHz -> pm
        await pg.locator('[aria-label="Centre value"]').fill('193.4'); await pg.locator('[aria-label="Centre unit"]').select_option('THz')
        await pg.locator('[aria-label="Width value"]').fill('100'); await pg.locator('[aria-label="Width unit"]').select_option('MHz')
        await pg.locator('[aria-label="Show the width in"]').select_option('pm'); await pg.wait_for_timeout(200)
        print('193.4 THz, 100 MHz -> pm:', await pg.locator('.page.conv .cv-row.main').inner_text())
        print('serialized:', await E("JSON.stringify(__app.page.serialize().ph)"))
        print('errors:', errs)
        await b.close()
asyncio.run(main())
