# 2.8 units: more units, combined units, units Giac reads differently, your own units and constants.
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page && __app.cas"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        async def run(tex):
            await E(f"(async()=>{{const p=__app.pages[0]; __app.select(0); p.mf.value={tex!r}; await p.enter();}})()"); await pg.wait_for_timeout(900)
            return await E("(h=>(h.error||h.out)+'  |  '+(h.unit?h.unit.v+' '+h.unit.u:''))(__app.pages[0].history.at(-1))")
        tests = [
            ('3 Da → kg', "3\\mathrm{\\_Da}\\to\\mathrm{\\_kg}"),
            ('1 knot → m/s', "1\\mathrm{\\_kn}\\to\\mathrm{\\_m}/\\mathrm{\\_s}"),
            ('20 °C → °F (absolute)', "20\\mathrm{\\_°C}\\to\\mathrm{\\_°F}"),
            ('2 furlong → m', "2\\mathrm{\\_furlong}\\to\\mathrm{\\_m}"),
            ('5 W/(m·K)×2 m', "5\\mathrm{\\_W}/\\left(\\mathrm{\\_m}\\cdot\\mathrm{\\_K}\\right)\\cdot2\\mathrm{\\_m}"),
            ('17 ps/(nm·km) × 1 nm × 10 km', "17\\mathrm{\\_ps}/\\left(\\mathrm{\\_nm}\\cdot\\mathrm{\\_km}\\right)\\cdot1\\mathrm{\\_nm}\\cdot10\\mathrm{\\_km}"),
            ('1.6 km × 2 (native)', "1.6\\mathrm{\\_km}\\times2"),
            ('1 Msun → kg', "1\\mathrm{\\_M☉}\\to\\mathrm{\\_kg}"),
            ('3 Å → nm', "3\\mathrm{\\_Å}\\to\\mathrm{\\_nm}"),
        ]
        for name, t in tests: print(f'{name:34s}', await run(t))
        # your own unit and constant
        await E("__app.settings.userUnits=[{sym:'thouu',def:'25.4 µm',name:'thou'}]; Units.defineUser(__app.settings.userUnits); __app.settings.userConsts=[{name:'lref',value:'1550.12 nm'}]; __app.applyCasSettings()"); await pg.wait_for_timeout(800)
        print(f'{"3 thouu → mm":34s}', await run("3\\mathrm{\\_thouu}\\to\\mathrm{\\_mm}"))
        print(f'{"c/lref → THz":34s}', await run("\\frac{299792458\\mathrm{\\_m}/\\mathrm{\\_s}}{\\mathrm{lref}}\\to\\mathrm{\\_THz}"))
        # converter lists torque separately from energy
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(400)
        await pg.locator('.page.conv input.search').first.fill('torque'); await pg.wait_for_timeout(200)
        await pg.locator('.page.conv .chip', has_text='Torque').first.tap(); await pg.wait_for_timeout(300)
        print('torque units:', (await pg.locator('.page.conv select').first.locator('option').all_inner_texts())[:6])
        await pg.locator('.page.conv input.search').first.fill('GVD'); await pg.wait_for_timeout(200)
        await pg.locator('.page.conv .chip').first.tap(); await pg.wait_for_timeout(300)
        print('gvd from/to:', await pg.locator('.page.conv .cv-row.main').inner_text())
        print('own unit in Length list:', 'thouu' in ''.join(await E("Units.quantityOf(Units.parse('m').d)[2].join(',')")))
        # units sheet
        await E("__app.select(0)"); await E("__app.unitsSheet()"); await pg.wait_for_timeout(400)
        print('unit groups:', await pg.locator('#sheet-body details.ugrp').count())
        await pg.locator('#sheet-body input[aria-label="Unit to insert"]').fill('mW/(cm²·nm)'); await pg.locator('#sheet-body .btn.pri', has_text='Insert').tap(); await pg.wait_for_timeout(300)
        print('inserted:', await E("__app.pages[0].mf.value"))
        await E("__app.unitsSheet()"); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body input[aria-label="Unit to insert"]').fill('debye'); await pg.wait_for_timeout(300)
        print('search debye:', await pg.locator('#sheet-body details.ugrp[open] summary').all_inner_texts())
        await pg.screenshot(path='out/units28_sheet.png')
        await E("UI.Sheet.close()")
        # Mine tab
        await E("Library.open(__app,'mine')"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/units28_mine.png')
        print('mine rows:', await pg.locator('#sheet-body .mlist .lbl').all_inner_texts())
        print('errors', errs)
        await b.close()
asyncio.run(main())
