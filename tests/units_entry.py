# CAS entry line: units from the Units menu, the abc _ key, and recalled old entries stay in math mode.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        V="__app.page.mf.value"
        # 1. unit menu, then × 2
        await E("__app.page.mf.value='1.6'; __app.page.mf.focus(); __app.page.mf.position=99")
        await E("__app.unitsSheet()"); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .chip', has_text='_km').first.tap(); await pg.wait_for_timeout(300)
        await E("__app.insert('\\\\times')"); await E("__app.typed('2')")
        print('unit menu then ×2:', await E(V))
        await E("__app.page.enter()"); await pg.wait_for_timeout(1500)
        print('  result:', await E("JSON.stringify(__app.page.history.at(-1).out)"))
        # 2. abc _ key, type km, then +
        await E("__app.page.mf.value='2'; __app.page.mf.position=99"); await E("__app.insert('\\\\_')")
        await E("for (const c of 'km') __app.typed(c)"); await E("__app.typed('+')"); await E("__app.typed('3')"); await E("__app.insert('\\\\_')"); await E("__app.typed('m')")
        print('_ key typed:', await E(V))
        await E("__app.page.enter()"); await pg.wait_for_timeout(1500)
        print('  result:', await E("JSON.stringify(__app.page.history.at(-1).out)"))
        # 3. old saved entry recalled
        await E("__app.page.history.push({tex:GiacFmt.fixUnitTex('1.6\\\\text{\\\\_km}'), out:'1.6_km'}); __app.page.recall()")
        await E("__app.page.mf.position=99"); await E("__app.insert('\\\\times')"); await E("__app.typed('3')")
        print('recalled old:', await E(V))
        await E("__app.page.enter()"); await pg.wait_for_timeout(1500)
        print('  result:', await E("JSON.stringify(__app.page.history.at(-1).out)"))
        await pg.screenshot(path='out/units_entry.png')
        print(errs); await b.close()
asyncio.run(main())
