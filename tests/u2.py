import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8092/www/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        await pg.tap('[data-a=library]'); await pg.wait_for_timeout(400)
        await pg.fill('#sheet-body input[type=search]', 'Planck constant'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi').first.tap(); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/pu_h1.png')
        await pg.locator('#sheet-body .ucs .chip', has_text='eV·s').tap(); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/pu_h2.png')
        await pg.locator('#sheet-body .mi', has_text='Insert value').tap(); await pg.wait_for_timeout(300)
        await E("__app.page.enter && __app.page.enter(false)"); await pg.wait_for_timeout(1500)
        print('calc last:', await E("[...document.querySelectorAll('.page:not([hidden]) .row')].slice(-1).map(r=>r.innerText.replace(/\\s+/g,' ')).join()"))
        # constant in light equivalents: HeNe
        await pg.tap('[data-a=library]'); await pg.wait_for_timeout(300)
        await pg.fill('#sheet-body input[type=search]', 'HeNe'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi').first.tap(); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/pu_hene.png', full_page=False)
        # convert tab
        await pg.locator('#sheet-body .seg button', has_text='Convert').first.tap() if False else None
        await E("Library.open(__app,'conv')"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/pu_conv1.png')
        await pg.fill('#sheet-body input[aria-label="From unit"]', 'psi'); await pg.fill('#sheet-body input[aria-label="To unit"]', 'MPa'); await pg.fill('#sheet-body input[aria-label=Value]', '3000'); await pg.wait_for_timeout(300)
        print('psi->MPa:', await E("document.querySelector('#sheet-body .cv-row.main').innerText.replace(/\\s+/g,' ')"))
        await pg.locator('#sheet-body .seg button', has_text='Light').tap(); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/pu_conv2.png')
        await pg.locator('#sheet-body .seg button', has_text='Number base').tap(); await pg.wait_for_timeout(300)
        print('base:', await E("document.querySelector('#sheet-body').innerText.slice(0,300).replace(/\\s+/g,' ')"))
        await pg.locator('#sheet-body .seg button', has_text='Decibels').tap(); await pg.wait_for_timeout(300)
        print('db:', await E("document.querySelector('#sheet-body').innerText.slice(0,300).replace(/\\s+/g,' ')"))
        await E("UI.Sheet.close(); __app.addPage('convert')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='out/pu_page.png')
        print('errors', errs[-8:])
        await b.close()
asyncio.run(main())
