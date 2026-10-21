# Guide & manuals tab, the Program tab's title, and the unit tidying rules.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        await ctx.add_init_script("window.__links=[]; window.TiBridge={openUrl:(u)=>__links.push(u), setOrientation(){}, exitApp(){}, saveFile(){return 'ok'}};")
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page && __app.cas"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        # program tab title
        await E("__app.addPage('prog')"); await pg.wait_for_timeout(300)
        print('program tab:', await E("__app.tabName(__app.page)"))
        # broken name saved by an older version
        print('tab with a broken saved name:', await E("(()=>{ const p=__app.page; p.name={}; const t=__app.tabName(p); const saved=JSON.stringify(__app.serializeDoc().pages.at(-1).name); p.name=''; return t+' (saved as '+saved+')'; })()"))
        # guide
        await pg.tap('#btn-doc'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Guide & manuals').tap(); await pg.wait_for_timeout(1200)
        print('guide headings:', await pg.locator('.gd-doc h2').count(), '| images:', await pg.locator('.gd-doc img').count(), '| tables:', await pg.locator('.gd-doc table').count())
        await pg.screenshot(path='out/guide_top.png')
        await pg.locator('.gd-doc a', has_text='Units').first.tap(); await pg.wait_for_timeout(800)
        print('scrolled to units:', await E("Math.round(document.querySelector('.gd-body').scrollTop)"))
        await pg.screenshot(path='out/guide_units.png')
        await pg.locator('.page.guide .seg button', has_text='manuals').tap(); await pg.wait_for_timeout(300)
        print('manual cards:', await pg.locator('.gd-man').count())
        await pg.locator('.gd-man .chip').first.tap(); await pg.wait_for_timeout(200)
        print('opened:', await E("__links"))
        await pg.screenshot(path='out/guide_manuals.png')
        # one guide tab only
        await E("__app.addPage('guide')"); print('guide tabs:', await E("__app.pages.filter(p=>p.kind==='guide').length"))
        # units
        await E("__app.select(0)")
        async def run(tex):
            await E(f"(async()=>{{const p=__app.pages[0]; p.mf.value={tex!r}; await p.enter();}})()"); await pg.wait_for_timeout(900)
            return await E("(h=>(h.error||h.out)+'  |  '+(h.unit?h.unit.v+' '+h.unit.u:''))(__app.pages[0].history.at(-1))")
        for name, t in [('3 ft × 2 m', '3\\mathrm{\\_ft}\\cdot2\\mathrm{\\_m}'), ('5 mm × 2 km', '5\\mathrm{\\_mm}\\cdot2\\mathrm{\\_km}'), ('100 J / 4 s', '\\frac{100\\mathrm{\\_J}}{4\\mathrm{\\_s}}'), ('3 V × 2 A', '3\\mathrm{\\_V}\\cdot2\\mathrm{\\_A}'), ('2 N × 3 m (torque)', '2\\mathrm{\\_N}\\cdot3\\mathrm{\\_m}'), ('60 km / 2 h', '\\frac{60\\mathrm{\\_km}}{2\\mathrm{\\_h}}'), ('asked: 25 W → J/s', '25\\mathrm{\\_W}\\to\\mathrm{\\_J}/\\mathrm{\\_s}')]:
            print(f'{name:24s}', await run(t))
        print('errors', errs); await b.close()
asyncio.run(main())
