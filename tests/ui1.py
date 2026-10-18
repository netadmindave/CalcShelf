import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2.625, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text)); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto("http://localhost:8091/index.html"); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='out/a_start.png')
        async def enter(tex, approx=False):
            await pg.evaluate("t=>{const mf=__app.page.mf; mf.value=t;}", tex)
            await pg.click('.kbar [data-a="%s"]' % ('approx' if approx else 'enter')); await pg.wait_for_timeout(900)
        for t in ['\\frac{1}{2}+\\frac{1}{3}', '\\operatorname{factor}\\left(x^2-1\\right)', '\\operatorname{solve}\\left(x^2=4,x\\right)', '\\int_{0}^{1}x^2\\,\\mathrm{d}x', '\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(\\sin\\left(x\\right)x\\right)', '\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}^{-1}', '\\sqrt{2}', '\\lbrace1,2,3\\rbrace\\cdot2', '\\sum_{n=1}^{\\infty}\\frac{1}{n^2}', '6x/3+\\frac{30\\pi}{180}']:
            await enter(t)
        await enter('\\sqrt{2}', True)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='out/a_calc.png')
        print('\n'.join(logs[-30:]))
        await b.close()
asyncio.run(main())
