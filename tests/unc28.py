# 2.8 uncertainty budget: correlations and Monte Carlo.
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
        await E("(async()=>{const p=__app.pages[0]; p.mf.value='\\\\left(5.03\\\\pm0.02\\\\right)\\\\cdot\\\\left(2.1\\\\pm0.1\\\\right)'; await p.enter();})()"); await pg.wait_for_timeout(1500)
        print('result:', await E("__app.pages[0].history.at(-1).outTex"))
        await E("__app.pages[0].uncSheet(__app.pages[0].history.at(-1))"); await pg.wait_for_timeout(400)
        await pg.locator('#sheet-body input[aria-label="r between x1 and x2"]').fill('0.8'); await pg.locator('#sheet-body input[aria-label="r between x1 and x2"]').dispatch_event('change'); await pg.wait_for_timeout(200)
        print('corr:', await pg.locator('#sheet-body .card p.desc').nth(1).inner_text())
        await pg.locator('#sheet-body .btn.pri', has_text='Monte Carlo').tap(); await pg.wait_for_timeout(1500)
        print('mc:', (await pg.locator('#sheet-body .dt-card').inner_text()).replace('\n',' | '))
        await pg.screenshot(path='out/unc28.png', full_page=True)
        # nonlinear: exp(3±0.5)
        await E("UI.Sheet.close()")
        await E("(async()=>{const p=__app.pages[0]; p.mf.value='\\\\exponentialE^{3\\\\pm0.5}'; await p.enter();})()"); await pg.wait_for_timeout(1500)
        await E("__app.pages[0].uncSheet(__app.pages[0].history.at(-1))"); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .btn.pri', has_text='Monte Carlo').tap(); await pg.wait_for_timeout(1500)
        print('mc exp:', (await pg.locator('#sheet-body .dt-card').inner_text()).replace('\n',' | '))
        print('errors', errs)
        await b.close()
asyncio.run(main())
