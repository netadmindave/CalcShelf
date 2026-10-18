import asyncio, sys, time
from playwright.async_api import async_playwright
import os; U=os.environ.get('CALC_FW', 'firmware') + '/'  # your own dumps + OS; never commit them
FILES=[U+f for f in ['injected_btrom.img.tns','manuf.img.tns','btldr.img.tns','instl.img.tns','diags.img.tns','osldr.img.tns','TI-NspireCXIICAS-6.4.0.74.tcc2','btrom.img.tns']]
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'ns'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); print('chromium', b.version)
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.5)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
        E=lambda js: pg.evaluate(js)
        await pg.goto(BASE+'/nspire/index.html'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'./{TAG}_setup0.png')
        await pg.set_input_files('#file-fw', FILES); await pg.wait_for_timeout(1500)
        print('files:', await E("[...document.querySelectorAll('#ns-files li')].map(l=>l.className+':'+l.textContent).join(' | ')"))
        print('setup err:', await E("document.querySelector('#setup-err').hidden ? '' : document.querySelector('#setup-err').textContent"))
        await pg.screenshot(path=f'./{TAG}_setup1.png')
        t0=time.time(); await pg.locator('#btn-install').click()
        last=''
        for i in range(240):
            await pg.wait_for_timeout(1000)
            st = await E("document.querySelector('#busy').hidden ? 'done' : document.querySelector('#busy-text').textContent")
            if st != last: print(f'{time.time()-t0:5.1f}s', st); last = st
            if i == 20: await pg.screenshot(path=f'./{TAG}_install.png')
            if st == 'done': break
        print('mode', await E("__ns.mode()"), 'tick', await E("__ns.tick()"))
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'./{TAG}_lang.png')
        # choose language, font, welcome: enter x3 (welcome OK needs a click)
        for k in range(2):
            await pg.locator('.key[data-k="1"]').click(); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'./{TAG}_welcome.png')
        await pg.locator('.key[data-k="1"]').click(); await pg.wait_for_timeout(3500)
        await pg.screenshot(path=f'./{TAG}_home.png')
        # new document: calculator: type 2+3*4 enter
        await pg.locator('.key[data-k="69"]').click(); await pg.wait_for_timeout(300)
        print('status', await E("document.querySelector('#status').textContent"))
        await E("__ns.saveState()"); await pg.wait_for_timeout(4000)
        await pg.reload(); await pg.wait_for_timeout(1000)
        for i in range(60):
            await pg.wait_for_timeout(1000)
            if await E("!!window.__ns && __ns.mode()==='run'"): break
        print('resumed after', i+1, 's; mode', await E("__ns.mode()"))
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'./{TAG}_resumed.png')
        print('errors', [e for e in errs][-8:])
        await b.close()
asyncio.run(main())
