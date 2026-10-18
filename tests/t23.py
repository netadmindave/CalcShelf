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
        # TI-36X tab, only one
        await pg.locator('#btn-addpage').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='TI-36X Pro').first.tap(); await pg.wait_for_timeout(700)
        await pg.locator('#btn-addpage').tap(); await pg.wait_for_timeout(300)
        print('add menu 2nd time:', await E("document.querySelector('#sheet .mlist').innerText.replace(/\\s+/g,' ').slice(0,200)"))
        await pg.locator('#sheet .mi', has_text='TI-36X Pro').first.tap(); await pg.wait_for_timeout(500)
        print('after ti36 x2:', await tabs())
        # emulator: HP-15C
        await pg.locator('#btn-addpage').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Emulated calculator').first.tap(); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'out/{TAG}_chooser.png')
        await pg.locator('#sheet [data-emu="hp:15c"]').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Switch to the HP-15C').tap(); await pg.wait_for_timeout(3500)
        print('after hp15c:', await tabs())
        await pg.screenshot(path=f'out/{TAG}_hp.png')
        # from inside the HP frame: Change calculator → TI-84+SE with a ROM
        fr = pg.frame_locator('#pages .page.emu iframe')
        await fr.locator('#btn-menu').tap(); await pg.wait_for_timeout(300)
        await fr.locator('#m-model').tap(); await pg.wait_for_timeout(500)
        print('sheet title:', await E("document.querySelector('#sheet-title') ? document.querySelector('#sheet-title').textContent : document.querySelector('#sheet h2, #sheet .title')?.textContent"))
        await pg.locator('#sheet [data-emu="z80:z"]').tap(); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc:
            await pg.locator('#sheet .mi', has_text='Choose OS file or ROM').tap()
        f = await fc.value; await f.set_files(U+'ti84se.rom'); await pg.wait_for_timeout(7000)
        print('after 84:', await tabs(), '| frame src:', await E("document.querySelector('#pages .page.emu iframe').getAttribute('src')"))
        await pg.screenshot(path=f'out/{TAG}_84.png')
        # from inside the classic frame: Replace OS → TI-89 chosen but a .9xu/.rom of a 92+ … use 92+ ROM with the TI-92 Plus model
        fr = pg.frame_locator('#pages .page.emu iframe')
        await fr.locator('#btn-menu').tap(); await pg.wait_for_timeout(300)
        print('classic m-os label:', await fr.locator('#m-os').inner_text())
        await fr.locator('#m-os').tap(); await pg.wait_for_timeout(500)
        await pg.locator('#sheet [data-emu="ti68k:92p"]').tap(); await pg.wait_for_timeout(300)
        async with pg.expect_file_chooser() as fc:
            await pg.locator('#sheet .mi', has_text='Choose OS file or ROM').tap()
        f = await fc.value; await f.set_files(U+'ti92p.rom'); await pg.wait_for_timeout(9000)
        print('after 92p:', await tabs(), '| setup hidden:', await fr.locator('#setup').is_hidden())
        await pg.screenshot(path=f'out/{TAG}_92p.png')
        # switch back to the 84 — keeps its OS and memory
        await pg.locator('#tabs .tab.on').tap(); await pg.wait_for_timeout(300)
        print('emu tab menu:', await E("document.querySelector('#sheet .mlist').innerText.replace(/\\s+/g,' ')"))
        await pg.locator('#sheet .mi', has_text='Replace OS or change calculator').tap(); await pg.wait_for_timeout(400)
        await pg.locator('#sheet [data-emu="z80:z"]').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet .mi', has_text='Switch to the TI-84+SE').tap(); await pg.wait_for_timeout(6000)
        print('back to 84:', await tabs(), '| setup hidden:', await fr.locator('#setup').is_hidden())
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
