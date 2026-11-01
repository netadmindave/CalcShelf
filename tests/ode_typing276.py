# Typing an equation in the Differential Equations tab with the keypad: the keypad appears for the equation fields
# and hides for the results; enter solves.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        await E("__app.addPage('ode')"); await pg.wait_for_timeout(400)
        kp = "getComputedStyle(document.querySelector('#kp')).display"
        print('tab:', await E("document.querySelector('.tab.on').textContent"), '| keypad at first:', await E(kp))
        await pg.locator('.page:not([hidden]) .ode-x').first.tap()   # remove the sample equation
        await pg.locator('.page:not([hidden]) .ode-x').first.tap()   # and its condition
        await pg.locator('.page:not([hidden]) .ode-add', has_text='equation').tap(); await pg.wait_for_timeout(300)
        mf = pg.locator('.page:not([hidden]) .ode-row math-field').first
        await mf.tap(); await pg.wait_for_timeout(300)
        print('keypad while typing:', await E(kp))
        await pg.keyboard.type("y''+4y=0"); await pg.wait_for_timeout(200)
        print('typed:', await E("__app.page.s.eqs[0]"))
        await pg.screenshot(path=OUT + '/ode_typing.png')
        await pg.locator('#kp .kbar [data-a="enter"]').tap(); await pg.wait_for_timeout(4000)
        print('keypad after enter:', await E(kp))
        print('result:', await E("__app.page.out.innerText.replace(/\\s+/g,' ').slice(0,200)"))
        await pg.screenshot(path=OUT + '/ode_typing_result.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
