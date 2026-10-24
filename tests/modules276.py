# Modules (2.7.6): built-in Optics and Machinist tabs, calculators, formulas with unit menus, tables with
# nearest-size search, importing a module file, refusing unsafe ones, and the scrolling tab bar.
import asyncio, json, os, sys, tempfile
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        print('modules:', await E("Modules.list.map(x => x.m.id + ' ' + x.source).join(', ')"))
        # the + menu lists them
        await pg.locator('#btn-addpage').click(); await pg.wait_for_timeout(400)
        print('+ menu has Optics:', await pg.locator('#sheet-body .mi', has_text='Optics').count() > 0)
        await pg.locator('#sheet-body .mi', has_text='Optics').first.click(); await pg.wait_for_timeout(800)
        print('tab:', await E("__app.tabName(__app.page)"), '| sections:', await E("[...document.querySelectorAll('.page:not([hidden]) .md-secs .chip')].map(c=>c.textContent).join(' / ')"))
        await pg.screenshot(path=OUT + '/mod_optics.png')
        # a calculator (it computes as it opens, with its defaults)
        await pg.locator('.page:not([hidden]) .mi', has_text='Wavelength, frequency and photon energy').click(); await pg.wait_for_timeout(2500)
        outs = await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => r.querySelector('.md-ol').textContent + ': ' + (r.querySelector('.md-ov').dataset.copy || r.querySelector('.md-ov').textContent)).join(' | ')")
        print('1550 nm:', outs)
        # change the input unit to µm and the frequency output to GHz
        await E("(() => { const s = document.querySelector('#sheet-body .md-pair select'); s.value = 'µm'; document.querySelector('#sheet-body .md-in').value = '1.55'; })()")
        await pg.locator('#sheet-body .btn.pri', has_text='Calculate').click(); await pg.wait_for_timeout(2000)
        await E("(() => { const s = document.querySelector('#sheet-body .md-out select'); s.value = 'GHz'; s.onchange(); })()")
        print('1.55 µm, ν in GHz:', await E("document.querySelector('#sheet-body .md-out .md-ov').dataset.copy"))
        await pg.screenshot(path=OUT + '/mod_calc.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # Gaussian beam with its plot
        await pg.locator('.page:not([hidden]) .md-secs .chip', has_text='Gaussian beams').click(); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Gaussian beam from its waist').click(); await pg.wait_for_timeout(4000)
        print('beam:', await E("[...document.querySelectorAll('#sheet-body .md-out')].slice(0,2).map(r => r.querySelector('.md-ov').dataset.copy).join(' | ')"), '| plot:', await E("!!document.querySelector('#sheet-body .plotbox')"))
        await pg.screenshot(path=OUT + '/mod_beam.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # a formula from the library, solved with units
        await pg.locator('.page:not([hidden]) .md-search').fill('rayleigh range'); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Rayleigh range').first.click(); await pg.wait_for_timeout(500)
        await E("""(() => { const rows = [...document.querySelectorAll('#sheet-body input[type=text]')]; const sels = [...document.querySelectorAll('#sheet-body select.fs-unit')];
            rows[1].value = '100'; sels[1].value = 'µm'; rows[3].value = '1550'; sels[2].value = 'nm'; sels[0].value = 'mm'; })()""")
        print('solver unit menus:', await E("[...document.querySelectorAll('#sheet-body select.fs-unit')].map(s => s.options[0].text + '…' + s.options.length).join(', ')"))
        await pg.locator('#sheet-body .btn.pri', has_text='Solve').click(); await pg.wait_for_timeout(3000)
        print('zR =', await E("document.querySelector('#sheet-body .card[hidden], #sheet-body .card:last-child') && [...document.querySelectorAll('#sheet-body .card')].pop().textContent.replace(/\\s+/g,' ').slice(0,80)"))
        await pg.screenshot(path=OUT + '/mod_solver.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # the Machinist module: nearest drills to 0.25 in, and the tap drill table
        await E("__app.addPage('module', { id: 'machinist' })"); await pg.wait_for_timeout(800)
        await pg.locator('.page:not([hidden]) .md-secs .chip', has_text='Drills').click(); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='All drills by size').click(); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body input[type=search]').fill('.257'); await pg.wait_for_timeout(500)
        print('nearest .257:', await E("[...document.querySelectorAll('#sheet-body tbody tr')].slice(0,4).map(r => r.textContent).join(' | ')"))
        await pg.locator('#sheet-body .chip', has_text='Nearest in mm').click(); await pg.locator('#sheet-body input[type=search]').fill('6.8'); await pg.wait_for_timeout(500)
        print('nearest 6.8 mm:', await E("[...document.querySelectorAll('#sheet-body tbody tr')].slice(0,3).map(r => r.textContent).join(' | ')"))
        await pg.screenshot(path=OUT + '/mod_drills.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .md-secs .chip', has_text='Threads').click(); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Unified (inch) tap drills').click(); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body input[type=search]').fill('1/4-20'); await pg.wait_for_timeout(300)
        print('1/4-20:', await E("document.querySelector('#sheet-body tbody tr').textContent"))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        for title in ['Three-wire thread measurement', 'Spindle speed for a material']:
            await pg.locator('.page:not([hidden]) .md-search').fill(title); await pg.wait_for_timeout(300)
            await pg.locator('.page:not([hidden]) .mi', has_text=title).first.click(); await pg.wait_for_timeout(2500)
            print(title + ':', await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => r.querySelector('.md-ov').dataset.copy || r.querySelector('.md-ov').textContent).join(' | ')"))
            await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .md-search').fill('bolt circle'); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Bolt circle').first.click(); await pg.wait_for_timeout(2500)
        print('bolt circle:', await E("document.querySelector('#sheet-body .md-ov').dataset.copy"))
        await pg.screenshot(path=OUT + '/mod_bolt.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .md-search').fill('nearest fraction'); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Decimal to nearest fraction').first.click(); await pg.wait_for_timeout(2500)
        print('0.3125 →', await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => r.querySelector('.md-ov').dataset.copy).join(' | ')"))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        print('angle mode still', await E("__app.settings.angle"), await E("__app.cas.eval('angle_radian')"))
        # importing: an unsafe module is refused, the example installs
        tmp = tempfile.mkdtemp()
        bad = json.load(open(os.path.join(HERE, '..', 'modules', 'example.json')))
        bad['id'] = 'evil'; bad['sections'][0]['items'][0]['outputs'][0]['expr'] = 'purge(x)'
        open(tmp + '/evil.json', 'w').write(json.dumps(bad))
        bad2 = json.loads(json.dumps(bad)); bad2['sections'][0]['items'][0]['outputs'][0]['expr'] = 'V/R'; bad2['sections'][0]['items'].append({'type': 'text', 'md': '<img src=x onerror=alert(1)>[x](javascript:alert(1))'}); bad2['id'] = 'texttest'
        open(tmp + '/texttest.json', 'w').write(json.dumps(bad2))
        for f in ['evil.json', 'texttest.json', '../../modules/example.json']:
            path = os.path.abspath(os.path.join(tmp, f)) if not f.startswith('..') else os.path.abspath(os.path.join(HERE, '..', 'modules', 'example.json'))
            async with pg.expect_file_chooser() as fc:
                await E("Modules.importFile(__app)")
            await (await fc.value).set_files(path); await pg.wait_for_timeout(800)
            title = await E("document.querySelector('#sheet-title') ? document.querySelector('#sheet-title').textContent : ''")
            print(os.path.basename(path), '->', title, '|', (await E("document.querySelector('#sheet-body').textContent"))[:110].replace('\n', ' '))
            if title == 'Install module':
                await pg.locator('#sheet-body .btn.pri').click(); await pg.wait_for_timeout(800)
            else:
                await E("UI.Sheet.close()")
        print('installed:', await E("Modules.list.map(x => x.m.id).join(', ')"), '| tab:', await E("__app.tabName(__app.page)"))
        await E("__app.addPage('module', { id: 'texttest' })"); await pg.wait_for_timeout(500)
        print('text module html:', await E("(() => { const d = [...document.querySelectorAll('.page:not([hidden]) .md-doc')]; return d.length ? d[d.length-1].innerHTML : '-'; })()"))
        await E("(() => { const m = Modules.get('texttest'); })()")
        # tabs: many open, the bar scrolls
        for k in ['graph', 'lists', 'notes', 'convert', 'guide']: await E(f"__app.addPage('{k}')")
        await pg.wait_for_timeout(500)
        sw = await E("(() => { const t = document.querySelector('#tabs'); return [t.scrollWidth, t.clientWidth, getComputedStyle(t).overflowX, getComputedStyle(t).touchAction]; })()")
        print('tab bar scrollWidth/clientWidth/overflow/touch:', sw)
        box = await pg.locator('#tabs').bounding_box()
        await E("document.querySelector('#tabs').scrollLeft = 0")
        cdp = await ctx.new_cdp_session(pg)
        x0, y = box['x'] + box['width'] * 0.8, box['y'] + box['height'] / 2
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y}]})
        for i in range(1, 16):
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 - 180 * i / 15, 'y': y}]}); await pg.wait_for_timeout(16)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(800)
        print('after a finger swipe, scrollLeft =', await E("document.querySelector('#tabs').scrollLeft"))
        await pg.screenshot(path=OUT + '/mod_tabs.png')
        # the solver in the Constants & formulas library also has unit menus now
        await E("__app.select(0)"); await pg.wait_for_timeout(300)
        await E("Library.open(__app, 'form')"); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body input[type=search]').fill('circle area'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi', has_text='Circle area').first.click(); await pg.wait_for_timeout(500)
        await E("""(() => { const i = [...document.querySelectorAll('#sheet-body input[type=text]')]; const s = [...document.querySelectorAll('#sheet-body select.fs-unit')]; i[1].value = '2'; s[1].value = 'in'; s[0].value = 'cm²'; })()""")
        await pg.locator('#sheet-body .btn.pri', has_text='Solve').click(); await pg.wait_for_timeout(2500)
        print('circle r = 2 in, A in cm²:', await E("[...document.querySelectorAll('#sheet-body .card')].pop().textContent.replace(/\\s+/g,' ').slice(0,60)"))
        await E("(() => { const s = [...document.querySelectorAll('#sheet-body select.fs-unit')]; s[1].value = ''; s[0].value = ''; })()")
        await pg.locator('#sheet-body .btn.pri', has_text='Solve').click(); await pg.wait_for_timeout(2500)
        print('circle r = 2 units:', await E("[...document.querySelectorAll('#sheet-body .card')].pop().textContent.replace(/\\s+/g,' ').slice(0,60)"))
        await pg.screenshot(path=OUT + '/mod_library.png')
        await E("UI.Sheet.close()")
        await E("__app.saveNow()"); await pg.reload(); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        print('after reload, tabs:', await E("__app.pages.map(p => __app.tabName(p)).join(' | ')"))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
