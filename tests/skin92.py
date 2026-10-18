import os
import asyncio, sys
from playwright.async_api import async_playwright
U=os.environ.get('CALC_FW', 'firmware') + '/'
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for slot in ['92p', 'v200']:
            for vw, vh, tag in [(852, 393, 'land'), (393, 808, 'port')]:
                ctx = await b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2.5, has_touch=True, is_mobile=True)
                pg = await ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
                await pg.goto(f'{BASE}/ti89/index.html?slot={slot}'); await pg.wait_for_timeout(1500)
                await pg.set_input_files('#file-os', U + 'ti92p.rom'); await pg.wait_for_timeout(6000)
                for k in ['2', 'PLUS', '3', 'ENTER1']:
                    await pg.locator(f'#skin .key[data-k="{k}"]').tap(); await pg.wait_for_timeout(350)
                await pg.wait_for_timeout(1200)
                await pg.screenshot(path=f'out/skin_{slot}_{tag}.png')
                # 2nd mode relabels
                await pg.locator('#skin .key[data-k="2ND"]').first.tap(); await pg.wait_for_timeout(500)
                await pg.screenshot(path=f'out/skin_{slot}_{tag}_2nd.png')
                await pg.locator('#skin .key[data-k="2ND"]').first.tap(); await pg.wait_for_timeout(300)
                print(slot, tag, 'turned' if await pg.evaluate("document.body.classList.contains('turned')") else 'upright', 'keys', await pg.locator('#skin .key').count(), 'errors', errs[-4:])
                await ctx.close()
        await b.close()
asyncio.run(main())
