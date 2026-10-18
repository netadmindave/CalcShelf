import asyncio, sys, time, shutil
from playwright.async_api import async_playwright
import os; U=os.environ.get('CALC_FW', 'firmware') + '/'  # your own dumps + OS; never commit them
FILES=[U+f for f in ['btrom.img.tns','injected_btrom.img.tns','manuf.img.tns','btldr.img.tns','instl.img.tns','diags.img.tns','osldr.img.tns','TI-NspireCXIICAS-6.4.0.74.tcc2']]
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'ns2'
PROF = '/tmp/ns_profile_' + TAG
async def main():
    shutil.rmtree(PROF, ignore_errors=True)
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(PROF, viewport={'width':393,'height':852}, device_scale_factor=2.5)
        pg = ctx.pages[0] if ctx.pages else await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_timeout(3000)
        await pg.evaluate("__app.emuChooser()"); await pg.wait_for_timeout(600)
        await pg.locator('[data-emu="nspire:cx2cas"]').click(); await pg.wait_for_timeout(600)
        async with pg.expect_file_chooser() as fc:
            await pg.locator('.mi[data-act^="Choose system files"]').click()
        await (await fc.value).set_files(FILES); await pg.wait_for_timeout(4000)
        print('tabs:', await pg.evaluate("[...document.querySelectorAll('#tabs .tab, .tab')].map(t=>t.textContent.trim()).filter(Boolean).join(' | ')"))
        fr = next(f for f in pg.frames if 'nspire' in f.url)
        print('files:', await fr.evaluate("[...document.querySelectorAll('#ns-files li')].map(l=>l.className).join(',')"), '| err:', await fr.evaluate("document.querySelector('#setup-err').hidden ? '-' : document.querySelector('#setup-err').textContent"))
        await pg.screenshot(path=f'./{TAG}_setup.png')
        t0=time.time(); await fr.locator('#btn-install').click(); last=''
        for i in range(300):
            await pg.wait_for_timeout(1000)
            st = await fr.evaluate("document.querySelector('#busy').hidden ? 'done' : document.querySelector('#busy-text').textContent.replace(/\\d+%/,'')")
            if st != last: print(f'{time.time()-t0:5.1f}s', st); last = st
            if st == 'done': break
        await pg.wait_for_timeout(1000); await pg.screenshot(path=f'./{TAG}_lang.png')
        K = lambda k: fr.locator(f'.key[data-k="{k}"]').click()
        for _ in range(3): await K(1); await pg.wait_for_timeout(3000)
        await K(1); await pg.wait_for_timeout(4000)          # A Calculate
        await pg.screenshot(path=f'./{TAG}_calc0.png')
        for k in [70, 68, 14, 52, 29]: await K(k); await pg.wait_for_timeout(250)   # 2+3×4
        await K(1); await pg.wait_for_timeout(2500)
        await fr.evaluate("__ns.typeText('factor(x^2-5x+6)', true)"); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=f'./{TAG}_calc1.png')
        print('status', await fr.evaluate("document.querySelector('#status').textContent"))
        # save through the bridge, as the app does on pause
        t1=time.time(); await pg.evaluate("__app.pages.find(p=>p.kind==='emu').saveFrame()"); print('bridge save', round(time.time()-t1,1), 's')
        await pg.wait_for_timeout(3000)
        await pg.reload(); await pg.wait_for_timeout(2000)
        idx = await pg.evaluate("__app.pages.findIndex(p=>p.kind==='emu')"); await pg.evaluate(f"__app.select({idx})")
        fr = next(f for f in pg.frames if 'nspire' in f.url)
        for i in range(60):
            await pg.wait_for_timeout(1000)
            if await fr.evaluate("!!window.__ns && __ns.mode()==='run'"): break
        print('resumed after', i+1, 's')
        await pg.wait_for_timeout(2000); await pg.screenshot(path=f'./{TAG}_resumed.png')
        print('errors', errs[-8:])
        await ctx.close()
asyncio.run(main())
