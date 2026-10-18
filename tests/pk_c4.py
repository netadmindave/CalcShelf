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
        E=lambda js: pg.evaluate(js)
        await pg.goto('http://localhost:8092/www/classic/index.html?model=z'); await pg.wait_for_timeout(1000)
        await pg.set_input_files('#file-os', U+'ti84se.rom'); await pg.wait_for_timeout(4000)
        await E("__classic.enqueueTap([0x0F])"); await pg.wait_for_timeout(500)
        for lab in ['2','+','3','enter']:
            await pg.locator('.key', has_text=lab).filter(has_text=lab).first.tap() if False else None
        await E("__classic.typeText('2+3*SIN(30)', true)"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='out/pk_c4_84.png')
        # send program
        await pg.set_input_files('#file-send', 'files/HELLO.8xp'); await pg.wait_for_timeout(4000)
        await E("__classic.typeText('', false); __classic.enqueueTap([0x1F])"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='out/pk_c4_prgm.png')
        await E("__classic.enqueueTap([0x09])"); await pg.wait_for_timeout(800); await E("__classic.enqueueTap([0x09])"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='out/pk_c4_run.png')
        # persistence: reload page
        await pg.evaluate("dispatchEvent(new Event('pagehide'))"); await pg.wait_for_timeout(1500)
        await pg.reload(); await pg.wait_for_timeout(4000)
        await pg.screenshot(path='out/pk_c4_resume.png')
        for m,f in [('6','ti86.rom'),('2','ti82.rom'),('7','ti73.rom'),('p','ti83plus.rom')]:
            await E(f"__classic.switchModel('{m}')"); await pg.wait_for_timeout(800)
            await pg.set_input_files('#file-os', U+f); await pg.wait_for_timeout(4000)
            await E("__classic.typeText('12*3', true)"); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=f'out/c4_{m}.png')
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
