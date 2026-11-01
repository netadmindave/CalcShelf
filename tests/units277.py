# Units Giac leaves uncombined are worked out in SI base units and shown with a prefix (√(190 cm²/s × 100 ns) = 43.6 µm),
# and the 123 keypad's new keys: units, eˣ (2nd x⁻¹), and ≈ for a decimal answer.
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
        async def run(tex, approx=False):
            await E("async ([t, a]) => { const p = __app.page; p.mf.value = t; await p.enter(a); }", [tex, approx]); await pg.wait_for_timeout(700)
            return await E("JSON.stringify([__app.page.history.at(-1).out, __app.page.history.at(-1).unit])")
        for t in ['\\sqrt{\\frac{190\\_cm^2}{\\_s}\\times100\\_ns}', '5\\_ft\\times3\\_m', '2\\_N\\times3\\_m', '100\\_mW\\times3\\_ns', '\\frac{9.81\\_m}{\\_s^2}\\times2\\_kg', '1.6\\_km\\times3', '\\frac{3\\_km}{2\\_h}', '\\sqrt{4\\_m^2}']:
            print(f'{t:45}', await run(t))
        # keys
        print('keys:', await E("[...document.querySelectorAll('#kpages .kpage[data-id=\"num\"] .key .kf')].slice(0,5).map(k => k.textContent).join(' ')"), '| last:', await E("[...document.querySelectorAll('#kpages .kpage[data-id=\"num\"] .key .kf')].pop().textContent"))
        key = lambda t: pg.locator('#kpages .kpage[data-id="num"] .key', has=pg.locator('.kf', has_text=t)).first.tap()
        await E("__app.page.mf.value = ''; __app.page.mf.focus()")
        await key('eˣ'); await key('2'); await pg.wait_for_timeout(200)
        print('eˣ 2 →', await E("__app.page.mf.value"))
        await key('≈'); await pg.wait_for_timeout(1500)
        print('≈ →', await E("JSON.stringify([__app.page.history.at(-1).out, __app.page.history.at(-1).approx])"))
        await key('units'); await pg.wait_for_timeout(500)
        print('units key opens:', await E("document.querySelector('#sheet-title').textContent"))
        await E("UI.Sheet.close()")
        await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + '/units277.png')
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
