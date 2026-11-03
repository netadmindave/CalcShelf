# The TI-84 Plus Silver Edition clock is set to the phone's local time (shown at the bottom of the MODE screen).
# Needs CALC_FW with ti84se.rom (your own dump).
import asyncio, os
from playwright.async_api import async_playwright
U = os.environ.get('CALC_FW', 'firmware') + '/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, timezone_id='America/New_York')
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/classic/index.html?model=z'); await pg.wait_for_timeout(1500)
        await pg.set_input_files('#file-os', U + 'ti84se.rom'); await pg.wait_for_timeout(8000)
        print('page time', await pg.evaluate("new Date().toLocaleString()"))
        print('setClock ->', await pg.evaluate("__classic.core().setClock(new Date())"))
        for k in ['CLEAR', 'MODE']:
            await pg.evaluate(f"__classic.enqueueTap([{ 0x0F if k == 'CLEAR' else 0x37 }])"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__classic.enqueueTap(Array(10).fill(0x01))"); await pg.wait_for_timeout(2500)   # down to SET CLOCK
        await pg.screenshot(path=OUT + '/clock84.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
