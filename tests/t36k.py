import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 't36k'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        await E("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(700)
        P="(__app.page.t36||__app.page)"
        async def k(*ids):
            for i in ids:
                sec = i.startswith('2:')
                if sec: await pg.locator('.key36[aria-label="2nd"]').tap(); i = i[2:]
                await pg.locator('.key36[aria-label="%s"]' % i).tap(); await pg.wait_for_timeout(90)
        nxt = lambda: E(P+".mf.executeCommand('moveToNextPlaceholder')")
        out = lambda: E(P+".mf.executeCommand('moveAfterParent')")
        async def ent(w=1100): await k('enter'); await pg.wait_for_timeout(w)
        last = lambda: E("(h=>h.in+' = '+(h.tex||h.err))((__app.page.t36||__app.page).history[(__app.page.t36||__app.page).history.length-1])")
        R=[]
        await pg.screenshot(path=f'out/{TAG}_pad.png')
        await k('2','add','3','mul','4'); await ent(); R.append(await last())
        await k('sin','3','0'); await ent(); R.append(await last())
        await k('sin','sin','0','dot','5'); await ent(); R.append(await last())
        await k('frac','1'); await nxt(); await k('2'); await out(); await k('add','frac','1'); await nxt(); await k('3'); await out(); await ent(); R.append(await last())
        await k('approx'); await pg.wait_for_timeout(800); R.append(await last())
        await k('pi','pi','pi'); R.append('pi x3 entry: '+await E(P+".mf.value")); await k('clear')
        await k('lnlog','lnlog','1','0','0'); await ent(); R.append(await last())
        await k('exp','exp','3'); await ent(); R.append(await last())
        await k('5','fact'); await ent(); R.append(await last())
        await k('fact','fact','5'); await nxt(); await k('2'); await ent(); R.append(await last())
        await k('3','sto','var'); await ent(); R.append(await last())
        await k('7','sto'); await k(*['var']*8); R.append('var x8 entry: '+await E(P+".mf.value")); await ent()
        await k('var'); await pg.wait_for_timeout(1700); await k('add'); await k(*['var']*8); await ent(); R.append(await last())
        await k('2:lnlog'); await k('var','sq'); await nxt(); await k('2'); await ent(1500); R.append(await last())
        await k('2:exp','0'); await nxt(); await k('2'); await nxt(); await k('var','sq'); await ent(1500); R.append(await last())
        await k('2:mul'); await pg.wait_for_timeout(400); await E("document.querySelector('#sheet-body math-field').value='\\\\times2'"); await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(300)
        await k('5','2:rpar'); await pg.wait_for_timeout(1100); R.append(await last())
        await k('2:rpar'); await pg.wait_for_timeout(1100); R.append(await last())
        await k('2:9'); await pg.wait_for_timeout(300); R.append('base tabs: '+await E("[...document.querySelectorAll('.t36-tabs button')].map(b=>b.textContent).join(',')")); await k('clear')
        await k('math'); await pg.wait_for_timeout(300); R.append('math tabs: '+await E("[...document.querySelectorAll('.t36-tabs button')].map(b=>b.textContent).join(',')"))
        await pg.screenshot(path=f'out/{TAG}_menu.png'); await k('clear')
        await k('2:fact'); await pg.wait_for_timeout(300); R.append('random tabs: '+await E("[...document.querySelectorAll('.t36-tabs button')].map(b=>b.textContent).join(',')")); await k('clear')
        await E(P+".setBase('hex')"); await k('2:1','add','2:6'); await ent(); R.append(await last()); await E(P+".setBase('dec')")
        await k('2:table'); await pg.wait_for_timeout(400); await E("(m=>{m.value='x^{2}+y';m.dispatchEvent(new Event('input'))})(document.querySelector('#sheet-body math-field'))"); await pg.wait_for_timeout(200)
        ins = pg.locator('#sheet-body .cv-units input'); R.append('expr vars: %d' % await ins.count())
        await ins.nth(0).fill('3'); await ins.nth(1).fill('1'); await pg.locator('#sheet-body .btn.pri').tap(); await pg.wait_for_timeout(1200)
        R.append('expr-eval: '+await E("document.querySelector('#sheet-body .t36-res').innerText.replace(/\\s+/g,' ')")); await E("UI.Sheet.close()")
        await k('2:add','2:add'); R.append('contrast '+await E(P+".lcd.style.filter"))
        await k('2:on'); await k('5'); R.append('off: '+str(await E(P+".off"))+' entry='+await E(P+".mf.value")); await k('on'); R.append('on: '+str(await E(P+".off")))
        await k('2'); await k('2:sub','2:sub')
        await pg.screenshot(path=f'out/{TAG}_a.png')
        await k('2nd'); await pg.wait_for_timeout(150); await pg.screenshot(path=f'out/{TAG}_2nd.png'); await k('2nd')
        for r in R: print(r)
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
