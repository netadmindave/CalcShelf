# (−) types a raised negation sign ⁻ that differs from the minus key and sits tight (3ᴇ⁻2), and the units key opens
# the unit list without the tap also picking a unit from it.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5, has_touch=True, is_mobile=True, color_scheme='dark')
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        key = lambda t: pg.locator('#kpages .kpage[data-id="num"] .key', has=pg.locator('.kf', has_text=t)).first.tap()
        enter = lambda: pg.locator('#kp .kbar [data-a="enter"]').tap()
        res = "JSON.stringify([__app.page.history.at(-1).out, __app.page.history.at(-1).tex])"
        await E("__app.page.mf.value = ''; __app.page.mf.focus()")
        for k in ['3', 'EE', '(−)', '2']: await key(k)
        print('entry:', await E("__app.page.mf.value"))
        await pg.locator('.page:not([hidden]) math-field').screenshot(path=OUT + '/neg_entry.png')
        await enter(); await pg.wait_for_timeout(1200); print('3ᴇ⁻2 =', await E(res))
        for k in ['(−)', '5', '−', '(−)', '2']: await key(k)
        print('entry:', await E("__app.page.mf.value"))
        await enter(); await pg.wait_for_timeout(1200); print('⁻5−⁻2 =', await E(res))
        for k in ['4', '×', '(−)', '3']: await key(k)
        await enter(); await pg.wait_for_timeout(1200); print('4×⁻3 =', await E(res))
        # the units key: a real tap (pointer and click) must not pick the unit under the finger
        await E("__app.page.mf.value = '5'; __app.page.mf.focus(); __app.page.mf.position = 99")
        for i in range(3):
            await key('units'); await pg.wait_for_timeout(600)
            print('units tap', i + 1, '| sheet open:', await E("UI.Sheet.isOpen"), '| entry:', await E("__app.page.mf.value"))
            await E("UI.Sheet.close()"); await pg.wait_for_timeout(200)
        await key('units'); await pg.wait_for_timeout(700)
        await pg.locator('#sheet-body .chip', has_text='mm').first.tap(); await pg.wait_for_timeout(400)
        print('then picking mm:', await E("__app.page.mf.value"))
        await pg.screenshot(path=OUT + '/neg278.png')
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
