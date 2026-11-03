# The Computer Science module: the IPv4 and IPv6 subnet calculators, storage and data-rate conversions, transfer
# time, bitwise operations, the reference tables, and its formulas in the Variable Solver.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        print('installed:', await E("!!Modules.get('compsci')"))
        await E("__app.addPage('module', { id: 'compsci' })"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=OUT + '/cs_home.png')
        page = '.page:not([hidden]) '
        async def sec(t): await pg.locator(page + '.md-secs .chip', has_text=t).first.click(); await pg.wait_for_timeout(300)
        async def item(t): await pg.locator(page + '.mlist .mi', has_text=t).first.click(); await pg.wait_for_timeout(600)
        sheet = pg.locator('#sheet-body')
        await sec('Subnetting'); await item('IPv4 subnet calculator')
        print('ipv4:', (await sheet.inner_text()).replace('\n', ' | ')[:420])
        await pg.screenshot(path=OUT + '/cs_ipv4.png')
        inp = sheet.locator('input.nc-in').first
        await inp.fill('10.20.30.40 255.255.240.0'); await inp.dispatch_event('input'); await pg.wait_for_timeout(300)
        t = await sheet.inner_text(); print('netmask form → /20:', '10.20.16.0/20' in t, '| bc 10.20.31.255:', '10.20.31.255' in t)
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('IPv6 subnet calculator')
        print('ipv6:', (await sheet.inner_text()).replace('\n', ' | ')[:300])
        await pg.screenshot(path=OUT + '/cs_ipv6.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await sec('Bits'); await item('Storage size')
        f = sheet.locator('input.md-in').first; await f.fill('1'); 
        await sheet.locator('select.fs-unit').first.select_option('GiB'); await f.press('Enter'); await pg.wait_for_timeout(1500)
        print('1 GiB:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | ')[:500])
        await pg.screenshot(path=OUT + '/cs_storage.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('Drive size'); await pg.wait_for_timeout(1500)
        print('2000 GB drive:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | '))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await sec('Data rates'); await item('Transfer time'); await pg.wait_for_timeout(1500)
        print('4.7 GB at 100 Mbit/s:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | '))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('Data rate'); await pg.wait_for_timeout(1500)
        print('1 Gbit/s:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | '))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await sec('RAID'); await item('RAID and ZFS array'); await pg.wait_for_timeout(1500)
        print('RAIDZ2 6x8TB:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | ').replace(' | Copy', ''))
        sel = sheet.locator('select.md-in').first
        for lev, n, g in [('2', '8', '1'), ('5', '12', '2'), ('9', '5', '1')]:
            await sel.select_option(lev); ins = sheet.locator('input.md-in'); await ins.nth(0).fill(n); await ins.nth(1).fill(g); await ins.nth(1).press('Enter'); await pg.wait_for_timeout(1200)
            print('lev', lev, n, g, ':', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | ').replace(' | Copy', ''))
        await pg.screenshot(path=OUT + '/cs_raid.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('Rebuild time'); await pg.wait_for_timeout(1500)
        print('rebuild:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | ').replace(' | Copy', ''))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('RAID and ZFS layouts'); print('raid table rows:', await sheet.locator('tr').count()); await pg.screenshot(path=OUT + '/cs_raidtbl.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await sec('Numbers'); await item('Bitwise'); await pg.wait_for_timeout(1500)
        print('12,10:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | '))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('Two'); await pg.wait_for_timeout(1500)
        print('-42 8-bit:', (await sheet.locator('.md-res').inner_text()).replace('\n', ' | '))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('Number base converter'); print('base tool:', (await sheet.inner_text()).replace('\n', ' | ')[:160])
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await item('ASCII'); print('ascii rows:', await sheet.locator('tr').count())
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # the solver: size and rate give the transfer time
        await E("__app.addPage('vsolve')"); await pg.wait_for_timeout(2500)
        await E("(vals) => { const p = __app.page, Q = VarSolver.VS.Q; for (const [id, raw, u] of vals) { const r = p.parseInput(Q[id], raw, u); p.S.user[id] = { v: r.v, raw }; p.S.units[id] = u; } return p.solve(); }", [['csS', '4.7', 'GB'], ['csR', '100', 'Mbit/s'], ['cseff', '0.94', ''], ['csRTT', '50', 'ms']])
        r = await E("(want) => { const p = __app.page, Q = VarSolver.VS.Q; return want.map((id) => { const k = p.known.get(id); if (!k) return id + ': —'; const s = p.shown(Q[id], k.v); return id + ' = ' + Units.num(s.x, 4) + ' ' + s.u; }); }", ['cst', 'csBDP'])
        await pg.screenshot(path=OUT + '/cs_solver.png')
        print('solver:', r)
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
