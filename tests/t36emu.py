# 2.8: the TI-36X Pro is an emulated calculator (not its own tab type); orientation per tab.
import asyncio, json
from playwright.async_api import async_playwright
BASE='http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        await ctx.add_init_script("window.__orient=[]; window.TiBridge={setOrientation:(o)=>__orient.push(o), exitApp(){}, saveFile(){return 'ok'}};")
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto(BASE+'/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        # an old document with a TI-36X Pro tab and an HP 48 tab migrates into one emulator tab that keeps the TI-36 memory
        old = {'id':'dold','name':'Old','pages':[{'kind':'calc','state':{}},{'kind':'ti36','state':{'mode':{'night':True},'history':[{'in':'2+2','out':'4'}]}},{'kind':'emu','state':{'fam':'hp','model':'48gx'}}],'active':0}
        await E(f"__app.openDoc({json.dumps(old)})"); await pg.wait_for_timeout(1500)
        print('tabs after migration:', await E("__app.pages.map(p=>p.kind+(p.fam?':'+p.fam+'/'+p.model:'')).join(', ')"))
        print('kept TI-36 memory:', await E("!!(__app.pages[1].t36State && __app.pages[1].t36State.mode.night)"))
        # + menu: no separate TI-36 entry; the chooser lists it under TI scientific
        await pg.tap('#btn-addpage'); await pg.wait_for_timeout(300)
        print('add menu:', [t.strip() for t in await pg.locator('#sheet-body .mi .lbl').all_inner_texts()])
        await pg.locator('#sheet-body .mi', has_text='Emulated calculator').tap(); await pg.wait_for_timeout(400)
        print('chooser has TI-36:', await pg.locator('#sheet-body [data-emu="ti36:36xpro"]').count())
        await pg.locator('#sheet-body [data-emu="ti36:36xpro"]').tap(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi', has_text='Switch to the TI-36X Pro').tap(); await pg.wait_for_timeout(1500)
        print('emu tab now:', await E("__app.page.fam+'/'+__app.page.model"), '| night kept:', await E("__app.page.t36.root.classList.contains('night')"), '| history rows:', await E("__app.page.t36.history.length"))
        # it works: type 3×4 and enter
        await E("__app.page.t36.mf.value='3\\\\times4'; __app.page.t36.enter()"); await pg.wait_for_timeout(1500)
        print('TI-36 result:', await E("JSON.stringify(__app.page.t36.history.at(-1))"))
        await pg.screenshot(path='out/t36emu.png')
        # tab menu offers Day display
        await pg.locator('#tabs .tab.on').tap(); await pg.wait_for_timeout(300)
        print('tab menu:', [t.strip() for t in await pg.locator('#sheet-body .mi .lbl').all_inner_texts()])
        await E("UI.Sheet.close()")
        # orientation: CAS → portrait, TI-36 → portrait, Graphs → follow phone
        await E("__app.select(0)"); await E("__app.addPage('graph')"); await E("__app.select(1)")
        print('orientation calls:', await E("__orient"))
        # serialize/restore round trip keeps the TI-36 memory
        d = await E("JSON.stringify(__app.serializeDoc().pages[1])"); print('saved emu page:', d[:120])
        print('errors', errs)
        await b.close()
asyncio.run(main())
