import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2)).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('response', lambda r: errs.append('404 '+r.url) if r.status==404 else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        page = pg.locator('.kpage[data-id="num"]')
        key = lambda lab: page.locator('.key', has=pg.locator('.kf', has_text=lab)).first
        async def tap(*labs):
            for l in labs: await key(l).click(); await pg.wait_for_timeout(70)
        val = lambda: E("__app.page.mf.value")
        out = lambda: E("[...document.querySelectorAll('.page:not([hidden]) .out')].pop()?.innerText.replace(/\\s+/g,'')")
        async def ent():
            await tap('enter'); await pg.wait_for_timeout(1300)
        print('-- CAS')
        print('empty + before any answer:', end=' '); await tap('+'); print(await val()); await E("__app.page.mf.value=''")
        await tap('2','+','3'); await ent(); print('2+3 =', await out())
        await tap('+','4'); print(' + on new line:', await val()); await ent(); print('  =', await out())
        await tap('×','2'); print(' × on new line:', await val()); await ent(); print('  =', await out())
        await tap('÷','3'); print(' ÷ on new line:', await val()); await ent(); print('  =', await out())
        await tap('^','2'); print(' ^ on new line:', await val()); await ent(); print('  =', await out())
        await tap('−','1'); print(' − on new line:', await val()); await E("__app.page.mf.value=''")
        await tap('(−)','1'); print(' (−) on new line:', await val()); await E("__app.page.mf.value=''")
        await tap('('); print(' ( :', await val()); await tap('2','+','3',')','×','4'); print(' (2+3)×4:', await val()); await ent(); print('  =', await out())
        await tap('2','+','3',')'); print(' 2+3) :', await val()); await tap('×','2'); print('   then ×2:', await val()); await ent(); print('  =', await out())
        await tap('(','1','+','÷','2',')','×','3'); print(' (1+½)×3 nested:', await val()); await ent(); print('  =', await out())
        await E("__app.page.mf.value=''; __app.page.mf.focus()"); await pg.keyboard.type('*10'); print(' keyboard *10:', await val()); await ent(); print('  =', await out())
        await E("__app.page.mf.value=''; __app.page.mf.focus()"); await pg.keyboard.type('(4+5)'); print(' keyboard (4+5):', await val()); await E("__app.page.mf.value=''")
        await E("__app.page.mf.value=''; __app.page.mf.focus()"); await pg.keyboard.type('6-1)'); print(' keyboard 6-1):', await val()); await E("__app.page.mf.value=''")
        print('-- TI-36X Pro')
        await E("__app.addPage('ti36')"); await pg.wait_for_timeout(600)
        k = lambda i: pg.locator('.key36[aria-label="%s"]' % i).click()
        async def ks(*ids):
            for i in ids:
                if i.startswith('2:'): await k('2nd'); i = i[2:]
                await k(i); await pg.wait_for_timeout(70)
        v36 = lambda: E("__app.page.mf.value")
        last = lambda: E("(h=>h.in+' = '+(h.tex||h.err))(__app.page.history[__app.page.history.length-1])")
        async def e36(): await ks('enter'); await pg.wait_for_timeout(1200)
        await ks('add'); print('empty + before any answer:', await v36()); await ks('clear')
        await ks('5','mul','3'); await e36(); print(await last())
        await ks('add','1'); print(' + new line:', await v36()); await e36(); print(' ', await last())
        await ks('sq'); print(' x² new line:', await v36()); await e36(); print(' ', await last())
        await ks('div','4'); print(' ÷ new line:', await v36()); await e36(); print(' ', await last())
        await ks('2:div'); print(' % new line:', await v36()); await e36(); print(' ', await last())
        await ks('fact'); print(' ! new line:', await v36()); await ks('clear')
        await ks('sto'); print(' sto→ new line:', await v36()); await ks('clear')
        await ks('neg','2'); print(' (−) new line:', await v36()); await ks('clear')
        await ks('lpar'); print(' ( :', await v36()); await ks('2','add','3','rpar','mul','4'); print(' (2+3)×4:', await v36()); await e36(); print(' ', await last())
        await ks('7','sub','2','rpar','mul','3'); print(' 7−2)×3:', await v36()); await e36(); print(' ', await last())
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
