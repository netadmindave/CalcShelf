import os
import asyncio
from playwright.async_api import async_playwright
U=os.environ.get('CALC_FW', 'firmware') + '/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8092/www/ti89/index.html?slot=92p'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/pk_t92_setup.png')
        await pg.set_input_files('#file-os', U+'ti92p.rom'); await pg.wait_for_timeout(5000)
        await pg.locator('#btn-menu').tap(); await pg.wait_for_timeout(400); await pg.locator('#s-lay92 button[data-v="pages"]').tap(); await pg.wait_for_timeout(600)
        await pg.evaluate("window.__ti.typeText('solve(x^2=4,x)', true)"); await pg.wait_for_timeout(6000)
        await pg.screenshot(path='out/pk_t92_math.png')
        # tap keys: 2 + 3 enter
        for k in ['2','PLUS','3','ENTER1']:
            await pg.locator(f'.key[data-k="{k}"]').first.tap(); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1500)
        await pg.locator('.key.pagekey').first.tap(); await pg.wait_for_timeout(300)
        for k in ['F','A','C','T']: await pg.locator(f'.key[data-k="{k}"]').first.tap(); await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(1000)
        await pg.screenshot(path='out/pk_t92_abc.png')
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
