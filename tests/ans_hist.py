# CAS: an entry that uses ans is saved in the history with the value ans stood for.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page && __app.cas"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        async def run(tex):
            await E(f"(async()=>{{const p=__app.pages[0]; p.mf.value={tex!r}; await p.enter();}})()"); await pg.wait_for_timeout(900)
            return await E("(h=>h.tex+'  =  '+(h.error||h.out))(__app.pages[0].history.at(-1))")
        for t in ['2+3', '\\operatorname{ans}\\times2', '\\frac{1}{3}', '\\operatorname{ans}+1', '-4', '\\operatorname{ans}^{2}', '1.6\\mathrm{\\_km}', '\\operatorname{ans}\\times3', 'x^2+1', '\\operatorname{ans}\\cdot2', '7', '\\operatorname{ans}\\left(3\\right)+1']:
            print(f'{t:40s} -> {await run(t)}')
        await pg.screenshot(path='out/ans_hist.png')
        print('errors', errs); await b.close()
asyncio.run(main())
