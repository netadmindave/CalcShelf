import asyncio
from playwright.async_api import async_playwright
import os; OS=os.environ.get('CALC_FW', 'firmware') + '/TI89Titanium_OS.89u'
BRIDGE="""window.__calls=[]; window.TiBridge={haptic(){__calls.push('h')}, saveFile(n,b,m){__calls.push('save:'+n); return 'Saved '+n}, exitApp(){__calls.push('exit')}};"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        await ctx.add_init_script(BRIDGE)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8092/www/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        async def run(t, approx=False): await E(f"(async()=>{{const p=__app.page; p.mf.value={t!r}; await p.enter({'true' if approx else 'false'});}})()")
        for t in ['\\int_{0}^{\\infty}e^{-x^2}\\,\\mathrm{d}x','\\operatorname{deSolve}\\left(y\'\'+4y=0,x,y\\right)','\\operatorname{laplace}\\left(t^2,t,s\\right)','\\begin{pmatrix}2 & 1\\\\ 1 & 2\\end{pmatrix}\\cdot\\begin{pmatrix}1\\\\ 1\\end{pmatrix}','\\operatorname{nSolve}\\left(e^{x}=3x,x\\right)','\\left(1+2i\\right)^{2}']:
            await run(t)
        await pg.wait_for_timeout(600)
        await pg.screenshot(path='out/e_apk_calc.png')
        # TI-89 page inside the app, load OS
        await E("__app.addPage('emu', {fam:'ti68k', model:'89'})"); await pg.wait_for_timeout(1500)
        fr = pg.frame_locator('iframe')
        frame = [f for f in pg.frames if 'ti89' in f.url][0]
        await frame.set_input_files('#file-os', OS); await pg.wait_for_timeout(6000)
        await frame.tap('.key[data-k="HOME"]'); await pg.wait_for_timeout(800)
        await frame.evaluate("window.__ti.typeText('factor(x^2-1)', true)"); await pg.wait_for_timeout(6000)
        await pg.screenshot(path='out/e_apk_ti89.png')
        r = await E("onAndroidBack()"); await pg.wait_for_timeout(500)
        print('back->', r, await E("__calls.filter(c=>c!=='h')"), 'errors:', errs[-6:])
        await b.close()
asyncio.run(main())
