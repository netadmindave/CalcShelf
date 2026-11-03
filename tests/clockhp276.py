# The HP 48GX clock follows the phone: TIME now, and again a minute later after returning to the app.
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2, timezone_id='America/New_York')
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/hp/index.html?model=48gx'); await pg.wait_for_timeout(7000)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        print('page time', await pg.evaluate("new Date().toTimeString()"))
        for ch in 'TIME': await pg.keyboard.type(ch); await pg.wait_for_timeout(150)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        await pg.wait_for_timeout(65000)   # a minute later, resync
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(500)
        for ch in 'TIME': await pg.keyboard.type(ch); await pg.wait_for_timeout(150)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
        print('page time', await pg.evaluate("new Date().toTimeString()"))
        await pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'clockhp.png'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
