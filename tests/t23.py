import re
import os
import asyncio, sys, re
from playwright.async_api import async_playwright
U=os.environ.get('CALC_FW', 'firmware') + '/'
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
TAG = sys.argv[2] if len(sys.argv) > 2 else 't23'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        E=lambda js: pg.evaluate(js)
        tabs = lambda: E("[...document.querySelectorAll('#tabs .tab')].map(t=>t.textContent+(t.classList.contains('on')?'*':'')).join(' | ')")
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        print('start tabs:', await tabs())
        # Eng format via settings UI
        await pg.locator('#btn-doc').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Settings').first.tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .seg button', has_text=re.compile('^Eng$')).tap(); await pg.wait_for_timeout(200)
        await E("UI.Sheet.close()")
        await E("__app.page.mf.value='\\\\frac{12345.678}{1}'"); await E("__app.page.enter(true)"); await pg.wait_for_timeout(1500)
        await E("__app.page.mf.value='0.000123456\\\\cdot1.0'"); await E("__app.page.enter(true)"); await pg.wait_for_timeout(1500)
        print('eng results:', await E("[...document.querySelectorAll('.page:not([hidden]) .out, .page:not([hidden]) .res')].slice(-2).map(x=>x.textContent).join(' ; ')"))
        print('settings.fmt:', await E("__app.settings.fmt"))
        await pg.screenshot(path=f'out/{TAG}_eng.png')
        # TI-36X Pro: since 2.8 it is in the emulated calculators, not its own entry in the + menu
        await pg.locator('#btn-addpage').tap(); await pg.wait_for_timeout(300)
        print('add menu has no TI-36 entry:', await pg.locator('#sheet .mlist .mi .lbl', has_text='TI-36X Pro').count() == 0)
        await E("UI.Sheet.close()")
        # emulator: HP 48GX
        await pg.locator('#btn-addpage').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Emulated calculator').first.tap(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'out/{TAG}_chooser.png')
        await pg.locator('#sheet [data-emu="hp:48gx"]').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text=re.compile("(Switch to|Open) the HP 48GX")).tap(); await pg.wait_for_timeout(3500)
        print('after hp48gx:', await tabs())
        await pg.screenshot(path=f'out/{TAG}_hp.png')
        # rename: long-press CAS tab
        cas = pg.locator('#tabs .tab').first
        bb = await cas.bounding_box()
        await pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(400)
        await pg.locator('#sheet input.search').fill('Main'); await pg.locator('#sheet .btn.pri').tap(); await pg.wait_for_timeout(300)
        print('renamed:', await tabs())
        # rename emulator tab and check it survives a model change name rule
        await E("__app.saveNow()"); await pg.wait_for_timeout(500)
        await pg.reload(); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(3000)
        print('after reload:', await tabs())
        # trig: triangle solver via menu
        await E("__app.select(0)"); await pg.wait_for_timeout(300)
        await pg.locator('#btn-doc').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Trigonometry').tap(); await pg.wait_for_timeout(500)
        for k,v in [('a','6'),('b','8'),('A','35')]: await pg.locator(f'#sheet .tri-in input[aria-label$=" {k}"]').fill(v)
        await pg.locator('#sheet .btn.pri', has_text='Solve').tap(); await pg.wait_for_timeout(400)
        print('triangle:', await E("document.querySelector('#sheet .tri-out').innerText.replace(/Insert/g,'').replace(/\\s+/g,' ').slice(0,400)"))
        await pg.screenshot(path=f'out/{TAG}_tri.png')
        await pg.locator('#sheet .seg button', has_text='Identities').tap(); await pg.wait_for_timeout(500)
        vs = pg.locator('#sheet .tri-ids .chip', has_text='Verify')
        print('verify buttons:', await vs.count())
        for i in [0, 9, 14]: await vs.nth(i).tap()
        await pg.wait_for_timeout(3000)
        print('verify:', await E("[...document.querySelectorAll('#sheet .tri-ids .row .sub')].map(s=>s.textContent).filter(Boolean).join(' | ')"))
        await pg.screenshot(path=f'out/{TAG}_ids.png')
        await pg.locator('#sheet .seg button', has_text='Trig formulas').tap(); await pg.wait_for_timeout(400)
        print('trig formulas:', await pg.locator('#sheet .mlist .mi').count())
        await pg.locator('#sheet .mlist .mi', has_text='Right triangle: sine').tap(); await pg.wait_for_timeout(400)
        ins = pg.locator('#sheet input[type=text]')
        await ins.nth(1).fill('3'); await ins.nth(2).fill('6'); await pg.locator('#sheet .btn.pri', has_text='Solve').tap(); await pg.wait_for_timeout(2500)
        print('sine solve (rad mode):', await E("[...document.querySelectorAll('#sheet .card')].pop().innerText.replace(/\\s+/g,' ')"))
        await E("UI.Sheet.close()")
        # CAS menu has the trig entries
        print('menus has triangle:', await E("JSON.stringify(NspireMenus.CALC_MENU).includes('Triangle solver')"))
        # migration of an old multi-doc / multi-emulator document
        await E("""(async()=>{ const d={id:'dold',name:'Old',pages:[{kind:'calc',state:{}},{kind:'ti89',state:{}},{kind:'classic',state:{model:'6'}},{kind:'hp',state:{model:'12c'}},{kind:'ti36',state:{}},{kind:'ti36',state:{}},{kind:'graph',state:{}}],defs:[]}; await UI.DB.set('doc:dold',d); await UI.DB.set('lastDoc','dold'); })()""")
        await pg.reload(); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(3000)
        print('migrated:', await tabs())
        print('errors', [e for e in errs if 'favicon' not in e][-8:])
        await b.close()
asyncio.run(main())
