import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'kp89'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        page = pg.locator('.kpage[data-id="num"]')
        key = lambda lab: page.locator('.key', has=pg.locator('.kf', has_text=lab)).first
        async def tap(*labs):
            for l in labs: await key(l).click(); await pg.wait_for_timeout(80)
        async def swipe(lab, dy):
            bb = await key(lab).bounding_box(); x = bb['x']+bb['width']/2; y = bb['y']+bb['height']/2
            await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x, y+dy, steps=4); await pg.mouse.up(); await pg.wait_for_timeout(120)
        val = lambda: E("(__app.page.t36||__app.page).mf.value")
        last = lambda: E("(h=>h? (h.tex||'')+' => '+(h.outTex||h.out||'') : '')((__app.page.t36||__app.page).history[(__app.page.t36||__app.page).history.length-1])")
        await pg.screenshot(path=f'out/{TAG}_pad.png')
        print('labels row1-2:', await E("[...document.querySelectorAll('.kpage[data-id=num] .key')].slice(0,10).map(k=>k.querySelector('.kf').textContent+'['+(k.querySelector('.ks')?.textContent||'')+'|'+(k.querySelector('.kd')?.textContent||'')+']').join(' ')"))
        await tap('3','÷','4'); print('3÷4 ->', await val())
        await tap('enter'); await pg.wait_for_timeout(1500); print('result:', await E("[...document.querySelectorAll('.page:not([hidden]) .out')].pop()?.textContent"))
        await tap('1','+','2','÷','3'); print('1+2÷3 ->', await val()); await tap('enter'); await pg.wait_for_timeout(1500); print('result:', await E("[...document.querySelectorAll('.page:not([hidden]) .out')].pop()?.textContent"))
        await tap('(','x','+','1',')','÷','2'); print('(x+1)÷2 ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        await swipe('y', -40); print('swipe up y ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        await swipe('y', 40); print('swipe down y ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        await swipe('^', -40); print('2nd ^ ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        await swipe('×', -40); print('2nd × ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        # long press x → popup → ◆
        bb = await key('x').bounding_box(); await pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); await pg.mouse.down(); await pg.wait_for_timeout(700); await pg.mouse.up()
        await pg.wait_for_timeout(150); print('popup:', await E("document.querySelector('.kpop')?.innerText.replace(/\\s+/g,' ')"))
        await pg.screenshot(path=f'out/{TAG}_pop.png')
        await pg.locator('.kpop .kpo.d').click(); await pg.wait_for_timeout(100); print('◆ x ->', await val()); await E("(__app.page.t36||__app.page).mf.value=''")
        await swipe('5', -40); await pg.wait_for_timeout(300); print('2nd 5 opens:', await E("document.querySelector('#sheet-title')?.textContent"), await pg.locator('#sheet').is_visible()); await E("UI.Sheet.close()")
        await tap('2','enter'); await pg.wait_for_timeout(1200); await swipe('enter', -40); print('2nd enter (entry) ->', await val())
        # TI-36X: ÷ fractional
        await E("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(600)
        for k in ['3','div','4']: await pg.locator('.key36[aria-label="%s"]' % k).click(); await pg.wait_for_timeout(80)
        print('ti36 3÷4 ->', await E("(__app.page.t36||__app.page).mf.value"))
        await pg.locator('.key36[aria-label="enter"]').click(); await pg.wait_for_timeout(1200)
        print('ti36 result:', await E("(h=>h.in+' = '+h.tex)((__app.page.t36||__app.page).history[(__app.page.t36||__app.page).history.length-1])"))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
