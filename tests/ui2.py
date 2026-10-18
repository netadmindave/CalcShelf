import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2.625, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text)); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto("http://localhost:8091/index.html"); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2000)
        # real taps on keys: 2 x ^2 + 1 ... use frac template: tap frac, 1, tab, 3, enter
        async def tap(sel): await pg.tap(sel); await pg.wait_for_timeout(120)
        keys=lambda label: f'.kpage[data-id="num"] .key:text-is("{label}")'
        await tap('.kpage[data-id="num"] .key:nth-child(3)')  # fraction
        await tap(keys('1')); await tap('#strip [data-a="tab"]'); await tap(keys('3')); await tap(keys('+')); await tap(keys('2'))
        await pg.screenshot(path='out/b_typing.png')
        await tap('.kbar [data-a="enter"]'); await pg.wait_for_timeout(1200)
        # menu → Calculus → Derivative
        await tap('#strip [data-a="menu"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/b_menu.png')
        await pg.tap('.mi:has-text("Calculus")'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/b_menu2.png')
        await pg.tap('.mi:has-text("Derivative") >> nth=0'); await pg.wait_for_timeout(300)
        # type x via key, then move to body: tab, sin(x)
        await tap('.kpage[data-id="num"] .key:nth-child(1)')  # x
        await tap('#strip [data-a="tab"]')
        await pg.evaluate("__app.showKeyPage('fn')"); await pg.wait_for_timeout(400)
        await tap('.kpage[data-id="fn"] .key:nth-child(1)')  # sin(
        await pg.evaluate("__app.showKeyPage('num')"); await pg.wait_for_timeout(400)
        await tap('.kpage[data-id="num"] .key:nth-child(1)')
        await pg.screenshot(path='out/b_deriv.png')
        await tap('.kbar [data-a="enter"]'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='out/b_after.png')
        print('\n'.join(logs[-20:]))
        await b.close()
asyncio.run(main())
