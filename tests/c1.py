import asyncio
from playwright.async_api import async_playwright
T='../core-build/tz80/test/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8091/classic/index.html?model=z'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='out/c_setup.png')
        await pg.set_input_files('#file-os', T+'testos.8xu'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c_84.png')
        # hold down arrow
        box = await pg.locator('.dk.down').bounding_box()
        await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await pg.mouse.down(); await pg.wait_for_timeout(500)
        await pg.screenshot(path='out/c_84_down.png'); await pg.mouse.up()
        # 2nd mode relabel
        await pg.locator('.key.mod-2nd').tap(); await pg.wait_for_timeout(200)
        await pg.screenshot(path='out/c_84_2nd.png')
        # switch to TI-86 via model picker after load: use API
        await pg.evaluate("__classic.switchModel('6')"); await pg.wait_for_timeout(800)
        await pg.set_input_files('#file-os', T+'t86.rom'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/c_86.png')
        print('errors', errs[-8:])
        await b.close()
asyncio.run(main())
