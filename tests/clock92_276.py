# The TI-92 Plus clock is set to the phone's local time (getTime() and getDate() on the Home screen).
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':852,'height':393}, device_scale_factor=2, timezone_id='America/New_York')
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/ti89/index.html?slot=92p'); await pg.wait_for_timeout(1500)
        await pg.set_input_files('#file-os', os.environ.get('CALC_FW', 'firmware') + '/ti92p.rom'); await pg.wait_for_timeout(14000)
        print('page time', await pg.evaluate("new Date().toString()"))
        t0 = await pg.evaluate("performance.now()")
        r = await pg.evaluate("__ti.core().setClock(new Date())")
        print('setClock ->', r, 'took', round(await pg.evaluate("performance.now()") - t0), 'ms')
        await pg.evaluate("__ti.typeText('getTime()\\n')"); await pg.wait_for_timeout(3000)
        await pg.evaluate("__ti.typeText('getDate()\\n')"); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'clock92.png'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
