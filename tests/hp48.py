import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
MODELS = sys.argv[2].split(',') if len(sys.argv) > 2 else ['48gx', '48sx', '49g', '49gp']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for m in MODELS:
            ctx = await b.new_context(viewport={'width': 393, 'height': 808}, device_scale_factor=2.5)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda x: errs.append(x.text) if x.type == 'error' else None)
            await pg.goto(f'{BASE}/hp/index.html?model={m}'); await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f'out/hp_{m}_0.png')
            # 1 ENTER 2 + by tapping keys, then type a symbolic expression
            ID = await pg.evaluate("__hp.ID")
            for k in ['1', 'ENTER', '2', '+']:
                await pg.locator(f'.key[data-id="{ID[k]}"]').click(); await pg.wait_for_timeout(250)
            await pg.wait_for_timeout(800)
            await pg.evaluate("__hp.typeText(\"'X^2-1'\\n\")"); await pg.wait_for_timeout(3000)
            await pg.screenshot(path=f'out/hp_{m}_1.png')
            # left shift shows the left legends
            await pg.locator(f'.key[data-id="{ID["LS"]}"]').click(); await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'out/hp_{m}_ls.png')
            await pg.locator(f'.key[data-id="{ID["LS"]}"]').click(); await pg.wait_for_timeout(400)
            await pg.evaluate("__hp.save()"); await pg.wait_for_timeout(1500)
            await pg.reload(); await pg.wait_for_timeout(3000)
            await pg.screenshot(path=f'out/hp_{m}_2.png')
            print(m, 'errors', errs[-5:])
            await ctx.close()
        await b.close()
asyncio.run(main())
