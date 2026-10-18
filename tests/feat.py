import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'feat'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.5, accept_downloads=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        async def run(t, w=1500):
            await E("(t)=>{ const p=__app.page; p.mf.value=t; return p.enter(false); }", t) if False else None
            await pg.evaluate("async (t)=>{ const p=__app.page; p.mf.value=t; await p.enter(false); }", t); await pg.wait_for_timeout(300)
        rowtxt = lambda: E("(()=>{const r=[...document.querySelectorAll('.page.calc .hist .row')].pop(); return r? r.innerText.replace(/\\s+/g,' ') : ''})()")
        hlast = lambda: E("(h=>JSON.stringify({out:h.out, outTex:h.outTex, dec:h.dec, unc:h.unc&&{v:h.unc.v,s:h.unc.s}, unit:h.unit}))(__app.page.history[__app.page.history.length-1])")
        for t in ['\\sqrt{2}', '\\frac{\\pi}{4}', '2^{40}', '\\frac{1}{3}', 'x+1']:
            await run(t); print(t, '->', await hlast())
        await run('\\left(5.03\\pm0.02\\right)\\times\\left(2.1\\pm0.1\\right)'); print('unc ->', await hlast(), '|', await rowtxt())
        await run('\\sin\\left(0.5\\pm0.01\\right)'); print('sin unc ->', await hlast())
        await run('\\frac{\\left(12.0\\pm0.3\\right)}{\\left(4.00\\pm0.05\\right)^2}'); print('ratio unc ->', await hlast())
        await pg.locator('.page.calc .hist .row .out').nth(-3).click(); await pg.wait_for_timeout(200)
        print('chips:', await E("[...document.querySelectorAll('.page.calc .picks .chip')].map(c=>c.textContent).join(', ')"))
        await pg.locator('.page.calc .picks .chip', has_text='Uncertainty budget').click(); await pg.wait_for_timeout(500)
        print('budget:', await E("document.querySelector('#sheet .unc-tbl').innerText.replace(/\\s+/g,' ')"))
        await pg.screenshot(path=f'out/{TAG}_budget.png'); await E("UI.Sheet.close()")
        # units
        await run('3\\text{_ft}+1\\text{_m}'); print('units ->', await hlast())
        print('unit chips:', await E("[...document.querySelectorAll('.page.calc .hist .row')].pop().querySelector('.uchips')?.innerText.replace(/\\s+/g,' ')"))
        await pg.locator('.page.calc .hist .row').last.locator('.uchips .chip', has_text='→ m').first.click(); await pg.wait_for_timeout(800)
        print('converted ->', await hlast())
        await run('9.81\\text{_m}/\\text{_s}^2\\cdot2\\text{_kg}'); print('force ->', await hlast())
        await pg.locator('.page.calc .hist .row').last.locator('.uchips .chip', has_text='→ N').first.click(); await pg.wait_for_timeout(800)
        print('to N ->', await hlast())
        await pg.screenshot(path=f'out/{TAG}_hist.png')
        # pin the √2 row
        await pg.locator('.page.calc .hist .row .out').first.click(); await pg.wait_for_timeout(200)
        await pg.locator('.page.calc .picks .chip', has_text='Pin').click(); await pg.wait_for_timeout(300)
        print('pins:', await E("document.querySelector('.page.calc .pins').innerText.replace(/\\s+/g,' ')"))
        # swipe-delete the last row, then undo
        n0 = await E("__app.page.history.length")
        row = pg.locator('.page.calc .hist .row').last; bb = await row.bounding_box()
        await pg.mouse.move(bb['x']+bb['width']*0.6, bb['y']+12); await pg.mouse.down(); await pg.mouse.move(bb['x']+bb['width']*0.6-180, bb['y']+14, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(500)
        n1 = await E("__app.page.history.length"); print('swipe delete:', n0, '->', n1, '| undo bar:', await E("document.querySelector('.undo-bar')?.innerText.replace(/\\s+/g,' ')"))
        await pg.screenshot(path=f'out/{TAG}_undo.png')
        await pg.locator('.undo-bar button').click(); await pg.wait_for_timeout(300); print('after undo:', await E("__app.page.history.length"))
        # copy LaTeX chip exists; export CSV from the tab menu
        await pg.locator('#tabs .tab.on').click(); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl:
            await pg.locator('#sheet .mi', has_text='Export history').click()
        d = await dl.value; path = await d.path(); txt = open(path).read()
        print('csv:', d.suggested_filename, '| lines', len(txt.splitlines()), '|', txt.splitlines()[0], '|', txt.splitlines()[6][:90])
        # settings toggles
        await pg.locator('#btn-doc').click(); await pg.wait_for_timeout(200); await pg.locator('#sheet .mi', has_text='Settings').first.click(); await pg.wait_for_timeout(300)
        print('settings:', await E("[...document.querySelectorAll('#sheet .setrow > span')].map(s=>s.textContent).join(' | ')"))
        await E("UI.Sheet.close()")
        # keypad ± (◆ of (−)) and f(x) page
        print('± keys:', await E("[...document.querySelectorAll('.kpage .key')].filter(k=>/±/.test(k.textContent)).length"))
        # TI-36 export
        await E("__app.addPage('ti36')"); await pg.wait_for_timeout(500)
        await E("(async()=>{const p=__app.page; p.mf.value='2+2'; await p.enter();})()"); await pg.wait_for_timeout(1200)
        await pg.locator('#tabs .tab.on').click(); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl:
            await pg.locator('#sheet .mi', has_text='Export history').click()
        d = await dl.value; print('ti36 csv:', d.suggested_filename, open(await d.path()).read().replace('\n',' | '))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
