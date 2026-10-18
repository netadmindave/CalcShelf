import asyncio
from playwright.async_api import async_playwright
T='../core-build/tz80/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2000)
        E=lambda js: pg.evaluate(js)
        await pg.tap('#btn-addpage'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='out/c2_add.png')
        await pg.locator('#sheet-body .mi', has_text='TI-85').tap(); await pg.wait_for_timeout(2500)
        fr = [f for f in pg.frames if 'classic' in f.url][0]
        await fr.set_input_files('#file-os', T+'t85.rom'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c2_85.png')
        # switch model inside frame -> parent state updates
        await fr.evaluate("__classic.switchModel('z')"); await pg.wait_for_timeout(800)
        print('parent model:', await E("__app.page.model"), await E("JSON.stringify(__app.serializeDoc().pages.map(p=>p.kind+':'+JSON.stringify(p.state)))"))
        print('back overlay:', await E("onAndroidBack()"))
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='out/c2_conv.png')
        print('errors', errs[-8:])
        await b.close()
asyncio.run(main())
