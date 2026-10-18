import os
import asyncio
from playwright.async_api import async_playwright
U=os.environ.get('CALC_FW', 'firmware') + '/'
OUT='../docs/img/'
B='http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mk = lambda w=393, h=852, scheme='light': b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, color_scheme=scheme, has_touch=True)
        # CAS
        ctx = await mk(); pg = await ctx.new_page()
        await pg.goto(B + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        for t in ['\\int_0^{\\pi}\\sin\\left(x\\right)^2dx', '\\operatorname{solve}\\left(x^2-5x+6=0,x\\right)', '\\frac{d}{dx}\\left(x^3\\cdot e^x\\right)', '\\sqrt{2}', '\\left(5.03\\pm0.02\\right)\\times\\left(2.1\\pm0.1\\right)', '9.81\\text{_m}/\\text{_s}^2\\cdot2\\text{_kg}']:
            await pg.evaluate("async (t)=>{ const p=__app.page; p.mf.value=t; await p.enter(false); }", t); await pg.wait_for_timeout(900)
        await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + 'cas.png')
        # TI-36X Pro
        await pg.evaluate("__app.addPage('ti36')"); await pg.wait_for_timeout(1200)
        for t in ['\\frac{1}{2}+\\frac{1}{3}', '\\sin\\left(30\\right)', '\\sqrt{8}']:
            await pg.evaluate("async (t)=>{ const p=__app.pages[__app.active]; p.mf.value=t; await p.enter(); }", t); await pg.wait_for_timeout(900)
        await pg.screenshot(path=OUT + 'ti36.png')
        await pg.evaluate("__app.pages[__app.active].setNight(true)"); await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + 'ti36_night.png')
        await pg.evaluate("__app.pages[__app.active].setNight(false)")
        # Trig solver
        await pg.evaluate("Library.open(__app, 'trig')"); await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + 'trig.png')
        await ctx.close()
        # TI-89 Titanium
        ctx = await mk(); pg = await ctx.new_page()
        await pg.goto(B + '/ti89/index.html'); await pg.wait_for_timeout(1500)
        await pg.set_input_files('#file-os', U + 'TI89Titanium_OS.89u'); await pg.wait_for_timeout(9000)
        await pg.evaluate("__ti.typeText('solve(x^2-2=0,x)', true)"); await pg.wait_for_timeout(6000)
        await pg.evaluate("__ti.typeText('∫(sin(x)^2,x,0,π)', true)"); await pg.wait_for_timeout(6000)
        await pg.screenshot(path=OUT + 'ti89.png'); await ctx.close()
        # TI-84 Plus SE
        ctx = await mk(); pg = await ctx.new_page()
        await pg.goto(B + '/classic/index.html?model=z'); await pg.wait_for_timeout(1000)
        await pg.set_input_files('#file-os', U + 'ti84se.rom'); await pg.wait_for_timeout(5000)
        await pg.evaluate("window.__c && __c.typeText ? __c.typeText('2+3*4', true) : null"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + 'ti84.png'); await ctx.close()
        await b.close()
asyncio.run(main())
