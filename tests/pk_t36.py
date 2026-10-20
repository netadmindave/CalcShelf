import asyncio, re
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto('http://localhost:8092/www/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        await E("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(600)
        P="(__app.page.t36||__app.page)"
        IDS={'+':'add','×':'mul','n/d':'frac'}
        SEC={'table':'approx','5':'cos','6':'tan'}
        async def tap(lab, sec=False):
            i = SEC[lab] if sec else IDS.get(lab, lab)
            if sec: await pg.locator('.key36[aria-label="2nd"]').tap()
            await pg.locator('.key36[aria-label="%s"]' % i).tap(); await pg.wait_for_timeout(120)
        for k in ['2','+','3','×','4']: await tap(k)
        await tap('enter'); await pg.wait_for_timeout(1200)
        await tap('sin'); await tap('3'); await tap('0'); await tap('enter'); await pg.wait_for_timeout(1200)
        await tap('n/d'); await tap('1'); await E(P+".mf.executeCommand('moveToNextPlaceholder')"); await tap('2'); await E(P+".mf.executeCommand('moveAfterParent')"); await tap('+'); await tap('n/d'); await tap('1'); await E(P+".mf.executeCommand('moveToNextPlaceholder')"); await tap('3'); await E(P+".mf.executeCommand('moveAfterParent')"); await tap('enter'); await pg.wait_for_timeout(1200)
        await tap('table', True); await pg.wait_for_timeout(1000)
        await E(P+".mf.value='\\\\sqrt{2}'"); await tap('enter'); await pg.wait_for_timeout(1200)
        await E(P+".mf.value='3\\\\to x'"); await tap('enter'); await pg.wait_for_timeout(1000)
        await E(P+".mf.value='x^{2}+1'"); await tap('enter'); await pg.wait_for_timeout(1000)
        await E(P+".mf.value='\\\\operatorname{bitand}\\\\left(12,10\\\\right)'"); await tap('enter'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='out/t36_a.png')
        await tap('math'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='out/t36_menu.png')
        await tap('clear'); 
        # poly solve
        await tap('5', True); await pg.wait_for_timeout(400)
        ins = pg.locator('#sheet-body input')
        await ins.nth(0).fill('1'); await ins.nth(1).fill('0'); await ins.nth(2).fill('-4')
        await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(1200)
        print('poly:', await E("document.querySelector('#sheet-body .t36-res').innerText.replace(/\\s+/g,' ')"))
        await E("UI.Sheet.close()")
        # sys solve
        await tap('6', True); await pg.wait_for_timeout(400)
        ins = pg.locator('#sheet-body .t36-sys input')
        for i,v in enumerate(['1','1','3','1','-1','1']): await ins.nth(i).fill(v)
        await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(1200)
        print('sys:', await E("document.querySelector('#sheet-body .t36-res').innerText.replace(/\\s+/g,' ')"))
        await E("UI.Sheet.close()")
        # stats
        await E(P+".lists.L1=[1,2,3,4,5]; "+P+".lists.L2=[2.1,3.9,6.2,7.8,10.1]")
        await E(P+".reg('lin')"); await pg.wait_for_timeout(300); await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(600)
        print('reg:', await E("document.querySelector('#sheet-body .t36-res').innerText.replace(/\\s+/g,' ')"))
        await pg.screenshot(path='out/t36_reg.png')
        await E("UI.Sheet.close()")
        # mode: rad, sin(pi/2)
        await E(P+".S.angle='rad'; "+P+".renderInd()"); await E(P+".mf.value='\\\\sin\\\\left(\\\\frac{\\\\pi}{2}\\\\right)'"); await tap('enter'); await pg.wait_for_timeout(1000)
        await E(P+".S.cplx='rect'"); await E(P+".mf.value='\\\\sqrt{-4}'"); await tap('enter'); await pg.wait_for_timeout(1000)
        await E(P+".mf.value='12'"); await E(P+".convert('in','cm')"); await pg.wait_for_timeout(800)
        print('hist:', await E("(__app.page.t36||__app.page).history.map(h=>h.in+' = '+(h.tex||h.err)).join(' | ')"))
        await pg.screenshot(path='out/t36_b.png')
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
