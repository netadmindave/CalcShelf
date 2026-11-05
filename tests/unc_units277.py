# Uncertainty propagation with units: 10 ± 0.001 mm × 1550.1 ± 0.001 nm, a σ in another unit (10 mm ± 1 nm),
# a quotient m/s, plain numbers, and mismatched units. Expect (15501.0±1.6) mm·nm, (15501.000±0.010) mm·nm,
# (4.000±0.043) m·s⁻¹, 10.56±0.50 and a units error.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2)).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        print('entry tex of a unit:', await pg.evaluate("Units.entryTex ? Units.entryTex('mm') : ''"))
        for t in ['10\\pm0.001\\mathrm{\\_mm}\\times1550.1\\pm.001\\mathrm{\\_nm}',
                  '10\\mathrm{\\_mm}\\pm1\\mathrm{\\_nm}\\times1550.1\\mathrm{\\_nm}\\pm1\\mathrm{\\_pm}',
                  '\\frac{12.0\\pm0.1\\mathrm{\\_m}}{3.00\\pm0.02\\mathrm{\\_s}}',
                  '(5.03\\pm0.02)\\cdot(2.1\\pm0.1)',
                  '10\\pm1\\mathrm{\\_s}+5\\mathrm{\\_kg}\\pm1\\mathrm{\\_g}']:
            await pg.evaluate("(t) => { const p = __app.page; p.mf.value = t; return p.enter(); }", t); await pg.wait_for_timeout(1800)
            print(await pg.evaluate("(() => { const r = document.querySelectorAll('.page:not([hidden]) .hist .row'); return r[r.length-1].querySelector('.out').innerText.replace(/\\n/g,' '); })()"))
        await pg.screenshot(path='out/unc_units.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
