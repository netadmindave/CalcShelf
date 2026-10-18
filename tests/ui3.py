import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2.625, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto("http://localhost:8091/index.html"); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        # Graphs
        await E("__app.addPage('graph')"); await pg.wait_for_timeout(500)
        for t in ['\\sin\\left(x\\right)', 'x^2/4-2', '\\frac{1}{x}']:
            await E(f"(()=>{{const p=__app.page; p.mf.value={t!r}; p.enter();}})()"); await pg.wait_for_timeout(700)
        await pg.screenshot(path='out/c_graph.png')
        # analyze zero via direct call (sheet)
        await E("__app.page.analyze('intersect')"); await pg.wait_for_timeout(400)
        await pg.tap('button:has-text("Calculate")'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/c_analyze.png')
        await E("UI.Sheet.close()")
        # Lists & spreadsheet with regression
        await E("__app.addPage('lists')"); await pg.wait_for_timeout(500)
        await E("""(async()=>{const p=__app.page; p.selectHead(0); p.mf.value='\\\\operatorname{xs}'; await p.enter(); p.selectHead(1); p.mf.value='\\\\operatorname{ys}'; await p.enter();
          const xs=[1,2,3,4,5,6], ys=[2.1,3.9,6.2,7.8,10.1,12.2];
          for(let i=0;i<6;i++){ p.selectCell(0,i+1); p.mf.value=String(xs[i]); await p.enter(); p.selectCell(1,i+1); p.mf.value=String(ys[i]); await p.enter(); }
          p.selectCell(2,1); p.mf.value='=a1*b1'; await p.enter(); })()"""); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c_lists.png')
        await E("Dialogs.open(__app,{dialog:'reg',reg:'linear'})"); await pg.wait_for_timeout(500)
        await pg.tap('button:has-text("Calculate")'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c_reg_graph.png')
        await E("__app.select(0)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='out/c_reg_calc.png')
        # Library: formula solver Rayleigh range
        await E("Library.open(__app)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/c_lib.png')
        await pg.tap('.seg button:has-text("Formulas")'); await pg.wait_for_timeout(300)
        await pg.fill('.sheet .search', 'Rayleigh'); await pg.wait_for_timeout(300)
        await pg.tap('.sheet .mi >> nth=0'); await pg.wait_for_timeout(300)
        inp = pg.locator('.sheet input[type=text]')
        await inp.nth(1).fill('0.5e-3'); await inp.nth(3).fill('1550e-9')
        await pg.tap('button:has-text("Solve")'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='out/c_solve.png')
        await E("UI.Sheet.close()")
        await E("__app.catalog()"); await pg.wait_for_timeout(600)
        await pg.fill('.sheet .search', 'normcdf'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/c_cat.png'); await E("UI.Sheet.close()")
        await E("__app.addPage('prog')"); await pg.wait_for_timeout(400)
        await pg.tap('button:has-text("Check syntax")'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='out/c_prog.png')
        await E("(async()=>{__app.select(0); const p=__app.page; p.mf.value='\\\\operatorname{fib}\\\\left(30\\\\right)'; await p.enter();})()"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c_fib.png')
        await E("__app.addPage('ti89')"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='out/c_ti89.png')
        print('\n'.join(logs[-25:]))
        await b.close()
asyncio.run(main())
