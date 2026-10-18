import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2.625, has_touch=True, is_mobile=True, color_scheme='dark')
        pg = await ctx.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error',) else None); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto("http://localhost:8091/index.html"); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        for t in ['\\operatorname{cSolve}\\left(x^3=1,x\\right)', '\\operatorname{taylor}\\left(\\sin\\left(x\\right),x,7\\right)', '\\operatorname{solve}\\left(x^2=2,x\\right)', '3\\text{_ft}\\to\\text{_m}', '\\operatorname{normCdf}\\left(-1.96,1.96\\right)']:
            await E(f"(async()=>{{const p=__app.page; p.mf.value={t!r}; await p.enter();}})()"); await pg.wait_for_timeout(700)
        await E(f"(async()=>{{const p=__app.page; p.mf.value={'\\operatorname{solve}\\left(x^2=2,x\\right)'!r}; await p.enter(true);}})()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='out/d_dark.png')
        await E("__app.addPage('notes')"); await pg.wait_for_timeout(300)
        await E("(async()=>{const p=__app.page; p.blocks=[{t:'text',v:'Gaussian beam check'},{t:'math',v:'\\\\frac{\\\\pi\\\\left(0.5\\\\times10^{-3}\\\\right)^2}{1550\\\\times10^{-9}}'}]; p.render(); await p.evalAll();})()"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='out/d_notes.png')
        await E("__app.docMenu()"); await pg.wait_for_timeout(400); await pg.screenshot(path='out/d_docs.png')
        await pg.tap('.mi:has-text("Settings")'); await pg.wait_for_timeout(300); await pg.screenshot(path='out/d_settings.png')
        await E("UI.Sheet.close()")
        await E("__app.select(0)"); await pg.set_viewport_size({'width':915,'height':412}); await pg.wait_for_timeout(800)
        await pg.screenshot(path='out/d_land.png')
        print(logs[-10:])
        await b.close()
asyncio.run(main())
